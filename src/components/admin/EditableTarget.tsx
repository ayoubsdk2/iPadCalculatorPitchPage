import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import type { EditableOverride } from "@/lib/layout-settings";

type DragAction = {
  type: "move" | "resize" | "content";
  pointerId: number;
  startClientX: number;
  startClientY: number;
  start: EditableOverride;
  startWidth: number;
  startHeight: number;
  handle?: string;
  activated: boolean;
};

export type EditableSelectOptions = {
  additive?: boolean;
  currentText?: string;
  stylePatch?: EditableOverride;
};

interface EditableTargetProps {
  id: string;
  label: string;
  enabled: boolean;
  selected: boolean;
  override?: EditableOverride;
  className?: string;
  previewMode?: boolean;
  onSelect: (id: string, label: string, options?: EditableSelectOptions) => void;
  onChange: (id: string, patch: EditableOverride) => void;
  onActivate?: () => void;
  children: ReactNode;
}

const HANDLE_POSITIONS = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

export function EditableTarget({
  id,
  label,
  enabled,
  selected,
  override,
  className,
  previewMode,
  onSelect,
  onChange,
  onActivate,
  children,
}: EditableTargetProps) {
  const showChrome = enabled && !previewMode;
  const ref = useRef<HTMLDivElement>(null);
  const actionRef = useRef<DragAction | null>(null);

  const current = normalizeOverride(override);
  if (enabled === false && current.hidden) {
    return null;
  }
  const boxStyle: CSSProperties = {
    transform: `translate(${current.x}px, ${current.y}px)`,
    width: current.width ? `${current.width}px` : undefined,
    height: current.height ? `${current.height}px` : undefined,
    zIndex: enabled && selected ? 30 : undefined,
    opacity: enabled && current.hidden ? 0.35 : undefined,
    outlineColor: enabled && current.hidden ? "var(--destructive)" : undefined,
    cursor: !enabled && onActivate ? "pointer" : undefined,
  };
  const contentStyle = {
    transform: `translate(${current.contentX}px, ${current.contentY}px)`,
    "--phaos-editable-zoom": current.zoom / 100,
    "--phaos-edit-font-family": current.fontFamily || undefined,
    "--phaos-edit-font-size": current.textFontSize || undefined,
    "--phaos-edit-font-weight": current.textFontWeight || undefined,
    "--phaos-edit-line-height": current.textLineHeight || undefined,
    "--phaos-edit-color": current.textColor || undefined,
    paddingTop: current.paddingY ? `${current.paddingY}px` : undefined,
    paddingBottom: current.paddingY ? `${current.paddingY}px` : undefined,
  } as CSSProperties;
  const replacementStyle = {
    fontFamily: current.fontFamily || undefined,
    fontSize: current.textFontSize || undefined,
    fontWeight: current.textFontWeight || undefined,
    lineHeight: current.textLineHeight || undefined,
    color: current.textColor || undefined,
  } as CSSProperties;
  const hasTextOverride = typeof override?.text === "string" && override.text.length > 0;

  const getTextSnapshot = (): EditableSelectOptions => {
    const content = ref.current?.querySelector<HTMLElement>(".phaos-editable-content");
    const textNode = content?.querySelector<HTMLElement>("div, span, button, th, td, li") ?? content;
    const text = content?.innerText?.trim() ?? label;
    const computed = textNode ? window.getComputedStyle(textNode) : null;
    return {
      currentText: current.text || text,
      stylePatch: {
        fontFamily: current.fontFamily || computed?.fontFamily,
        textFontSize: current.textFontSize || computed?.fontSize,
        textFontWeight: current.textFontWeight || computed?.fontWeight,
        textLineHeight: current.textLineHeight || computed?.lineHeight,
        textColor: current.textColor || computed?.color,
      },
    };
  };

  const startAction = (event: PointerEvent<HTMLDivElement>) => {
    if (!enabled) return;
    const target = event.target as HTMLElement;
    const handle = target.closest<HTMLElement>("[data-resize-handle]")?.dataset.resizeHandle;
    const contentHandle = target.closest<HTMLElement>("[data-content-handle]");
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    const interactiveTarget = target.closest<HTMLElement>(
      "button, input, textarea, select, [data-no-stage-tap]",
    );
    if (interactiveTarget && !handle && !contentHandle) {
      onSelect(id, label, { additive, ...getTextSnapshot() });
      return;
    }
    if ((!selected || additive) && !handle && !contentHandle) {
      event.preventDefault();
      event.stopPropagation();
      onSelect(id, label, { additive, ...getTextSnapshot() });
      return;
    }
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;

    event.preventDefault();
    event.stopPropagation();
    if (!selected || additive) {
      onSelect(id, label, { additive, ...getTextSnapshot() });
    }

    actionRef.current = {
      type: contentHandle ? "content" : handle ? "resize" : "move",
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      start: { ...(override ?? {}) },
      startWidth: current.width || rect.width,
      startHeight: current.height || rect.height,
      handle,
      activated: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveAction = (event: PointerEvent<HTMLDivElement>) => {
    const action = actionRef.current;
    if (!action || action.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();

    const dx = Math.round(event.clientX - action.startClientX);
    const dy = Math.round(event.clientY - action.startClientY);
    if (!action.activated && Math.hypot(dx, dy) < 4) return;
    action.activated = true;

    if (action.type === "content") {
      onChange(id, {
        ...action.start,
        contentX: Math.round((action.start.contentX ?? 0) + dx),
        contentY: Math.round((action.start.contentY ?? 0) + dy),
      });
      return;
    }

    if (action.type === "move") {
      onChange(id, {
        ...action.start,
        x: Math.round((action.start.x ?? 0) + dx),
        y: Math.round((action.start.y ?? 0) + dy),
      });
      return;
    }

    const h = action.handle ?? "se";
    let width = action.startWidth;
    let height = action.startHeight;
    let x = action.start.x ?? 0;
    let y = action.start.y ?? 0;

    if (h.includes("e")) width = action.startWidth + dx;
    if (h.includes("s")) height = action.startHeight + dy;
    if (h.includes("w")) {
      width = action.startWidth - dx;
      x = (action.start.x ?? 0) + dx;
    }
    if (h.includes("n")) {
      height = action.startHeight - dy;
      y = (action.start.y ?? 0) + dy;
    }

    onChange(id, {
      ...action.start,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.max(24, Math.round(width)),
      height: Math.max(24, Math.round(height)),
    });
  };

  const endAction = (event: PointerEvent<HTMLDivElement>) => {
    const action = actionRef.current;
    if (!action || action.pointerId !== event.pointerId) return;
    actionRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      ref={ref}
      data-editable-id={id}
      data-editing={showChrome ? "true" : undefined}
      data-selected={showChrome && selected ? "true" : undefined}
      className={["phaos-editable", className ?? ""].filter(Boolean).join(" ")}
      style={boxStyle}
      onPointerDown={startAction}
      onPointerMove={moveAction}
      onPointerUp={endAction}
      onPointerCancel={endAction}
      onClick={!enabled && onActivate ? (e) => { e.preventDefault(); onActivate(); } : undefined}
      role={!enabled && onActivate ? "button" : undefined}
    >
      <div
        className="phaos-editable-content"
        data-text-style={current.fontFamily || current.textFontSize || current.textFontWeight || current.textLineHeight || current.textColor ? "true" : undefined}
        style={contentStyle}
      >
        {hasTextOverride ? <div className="phaos-edit-text-replacement" style={replacementStyle}>{current.text}</div> : children}
      </div>
      {showChrome && selected && (
        <>
          <div className="phaos-edit-label">{label}</div>
          <button type="button" className="phaos-edit-content-handle" data-content-handle title="Drag contents/text">Aa</button>
          {HANDLE_POSITIONS.map((handle) => (
            <span key={handle} className={`phaos-edit-handle phaos-edit-handle-${handle}`} data-resize-handle={handle} />
          ))}
        </>
      )}
    </div>
  );
}

function normalizeOverride(override?: EditableOverride): Required<EditableOverride> {
  return {
    x: finiteNumber(override?.x, 0),
    y: finiteNumber(override?.y, 0),
    width: finiteNumber(override?.width, 0),
    height: finiteNumber(override?.height, 0),
    contentX: finiteNumber(override?.contentX, 0),
    contentY: finiteNumber(override?.contentY, 0),
    zoom: finiteNumber(override?.zoom, 100),
    paddingY: finiteNumber(override?.paddingY, 0),
    hidden: typeof override?.hidden === "boolean" ? override.hidden : false,
    fontFamily: typeof override?.fontFamily === "string" ? override.fontFamily : "",
    text: typeof override?.text === "string" ? override.text : "",
    textFontSize: typeof override?.textFontSize === "string" ? override.textFontSize : "",
    textFontWeight: typeof override?.textFontWeight === "string" ? override.textFontWeight : "",
    textLineHeight: typeof override?.textLineHeight === "string" ? override.textLineHeight : "",
    textColor: typeof override?.textColor === "string" ? override.textColor : "",
  };
}

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}