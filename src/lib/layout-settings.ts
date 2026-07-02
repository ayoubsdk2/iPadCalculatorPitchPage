// Tunable layout knobs. Defaults match the current CSS exactly.
// Editing these in /admin/editor saves to Supabase and applies to LIVE for everyone.

export type KnobUnit = "rem" | "%" | "px" | "fr" | "number";

export interface KnobDef {
  key: string;
  label: string;
  group: string;
  unit: KnobUnit;
  min: number;
  max: number;
  step: number;
  default: number;
  cssVar: string; // CSS custom property name
}

export const KNOBS: KnobDef[] = [
  // ----- Stage -----
  { key: "railColWidth",     label: "Rail column width",        group: "Stage",        unit: "rem", min: 3,  max: 14, step: 0.1,  default: 6.8,  cssVar: "--ph-rail-col" },
  { key: "stageGap",         label: "Gap (rail ↔ board)",       group: "Stage",        unit: "rem", min: 0,  max: 3,  step: 0.05, default: 0.55, cssVar: "--ph-stage-gap" },
  { key: "stagePadTop",      label: "Stage padding top",        group: "Stage",        unit: "rem", min: 0,  max: 3,  step: 0.05, default: 0.7,  cssVar: "--ph-stage-pad-top" },
  { key: "stagePadRight",    label: "Stage padding right",      group: "Stage",        unit: "rem", min: 0,  max: 3,  step: 0.05, default: 0.7,  cssVar: "--ph-stage-pad-right" },
  { key: "stagePadBottom",   label: "Stage padding bottom",     group: "Stage",        unit: "rem", min: 0,  max: 3,  step: 0.05, default: 0.5,  cssVar: "--ph-stage-pad-bottom" },
  { key: "stagePadLeft",     label: "Stage padding left",       group: "Stage",        unit: "rem", min: 0,  max: 3,  step: 0.05, default: 0.35, cssVar: "--ph-stage-pad-left" },

  // ----- Rail buttons (top-left 5) -----
  { key: "railPadTop",       label: "Rail top offset",          group: "Rail Buttons", unit: "rem", min: 0,  max: 12, step: 0.1,  default: 5.4,  cssVar: "--ph-rail-pad-top" },
  { key: "railGap",          label: "Gap between buttons",      group: "Rail Buttons", unit: "rem", min: 0,  max: 4,  step: 0.05, default: 1.55, cssVar: "--ph-rail-gap" },
  { key: "railBtnHeight",    label: "Button height",            group: "Rail Buttons", unit: "rem", min: 1.5,max: 8,  step: 0.1,  default: 3.3,  cssVar: "--ph-rail-btn-h" },
  { key: "railBtnRadius",    label: "Button corner radius",     group: "Rail Buttons", unit: "rem", min: 0,  max: 2,  step: 0.05, default: 0.55, cssVar: "--ph-rail-btn-radius" },
  { key: "railBtnIcon",      label: "Icon size",                group: "Rail Buttons", unit: "rem", min: 0.6,max: 3,  step: 0.05, default: 1.4,  cssVar: "--ph-rail-btn-icon" },
  { key: "railBtnFont",      label: "Label font size",          group: "Rail Buttons", unit: "rem", min: 0.5,max: 2,  step: 0.05, default: 0.95, cssVar: "--ph-rail-btn-font" },
  { key: "railBtnIconGap",   label: "Icon ↔ label gap",         group: "Rail Buttons", unit: "rem", min: 0,  max: 1,  step: 0.02, default: 0.1,  cssVar: "--ph-rail-btn-gap" },

  // ----- Board rows -----
  { key: "boardRow1",        label: "Row 1 height (Title)",     group: "Board Rows",   unit: "%",   min: 3,  max: 25, step: 0.5,  default: 8,    cssVar: "--ph-board-r1" },
  { key: "boardRow2",        label: "Row 2 height (9 cells)",   group: "Board Rows",   unit: "%",   min: 20, max: 70, step: 0.5,  default: 36,   cssVar: "--ph-board-r2" },
  { key: "boardRow3",        label: "Row 3 height (Role)",      group: "Board Rows",   unit: "%",   min: 4,  max: 30, step: 0.5,  default: 9.5,  cssVar: "--ph-board-r3" },
  { key: "boardRow4",        label: "Row 4 height (Slider)",    group: "Board Rows",   unit: "%",   min: 4,  max: 30, step: 0.5,  default: 12.5, cssVar: "--ph-board-r4" },
  { key: "boardRowGap",      label: "Row gap",                  group: "Board Rows",   unit: "%",   min: 0,  max: 8,  step: 0.25, default: 2,    cssVar: "--ph-board-row-gap" },
  { key: "boardColGap",      label: "Column gap",               group: "Board Rows",   unit: "rem", min: 0,  max: 3,  step: 0.05, default: 0.55, cssVar: "--ph-board-col-gap" },

  // ----- Board columns (fr ratios) -----
  { key: "boardCol1",        label: "Col 1 ratio",              group: "Board Columns",unit: "fr",  min: 0.4,max: 4,  step: 0.05, default: 1.4,  cssVar: "--ph-board-c1" },
  { key: "boardCol2",        label: "Col 2 ratio",              group: "Board Columns",unit: "fr",  min: 0.4,max: 4,  step: 0.05, default: 1.1,  cssVar: "--ph-board-c2" },
  { key: "boardCol3",        label: "Col 3 ratio",              group: "Board Columns",unit: "fr",  min: 0.4,max: 4,  step: 0.05, default: 1.2,  cssVar: "--ph-board-c3" },
  { key: "boardCol4",        label: "Col 4 ratio",              group: "Board Columns",unit: "fr",  min: 0.4,max: 4,  step: 0.05, default: 1.2,  cssVar: "--ph-board-c4" },

  // ----- 9 cells grid -----
  { key: "cellsGapY",        label: "Cells row gap",            group: "9 Cells",      unit: "rem", min: 0,  max: 3,  step: 0.05, default: 1,    cssVar: "--ph-cells-gap-y" },
  { key: "cellsGapX",        label: "Cells column gap",         group: "9 Cells",      unit: "rem", min: 0,  max: 3,  step: 0.05, default: 1.1,  cssVar: "--ph-cells-gap-x" },
];

export type Knobs = Record<string, number>;

export interface EditableOverride {
  [key: string]: number | string | boolean | undefined;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  contentX?: number;
  contentY?: number;
  zoom?: number;
  paddingY?: number;
  hidden?: boolean;
  fontFamily?: string;
  text?: string;
  textFontSize?: string;
  textFontWeight?: string;
  textLineHeight?: string;
  textColor?: string;
}

export type EditableOverrides = Record<string, EditableOverride>;

export type ImplBulletsLayout = "vertical" | "horizontal";

export const DEFAULT_IMPL_BULLETS: string[] = [
  "Bespoke System Design: A custom-tailored AI answering agent meticulously built around your exact business use case, operational rules, and unique brand voice.",
  "Telecom Provisioning and Support: Full allocation and infrastructure configuration of your dedicated forwarding telephone numbers from initial build to live status.",
  "Human Expert Alignment: Direct, 1-on-1 onboarding collaboration with a live expert across two dedicated launch-readiness sessions to set strict operational guardrails.",
  "Integration Alignment: Includes up to two dedicated engineering alignment calls to ensure seamless data sync validation.",
  "Comprehensive QA and Tuning: Exhaustive call flow quality assurance, recorded test calls, and two complete rounds of post-launch optimization.",
];

export interface CustomTextElement {
  [key: string]: string;
  id: string;
  defaultText: string;
}

export interface LayoutSettings {
  [key: string]: number | EditableOverrides | string[] | ImplBulletsLayout | CustomTextElement[] | undefined;
  elements?: EditableOverrides;
  implBullets?: string[];
  implBulletsLayout?: ImplBulletsLayout;
  customElements?: CustomTextElement[];
}

export const DEFAULT_KNOBS: Knobs = Object.fromEntries(KNOBS.map(k => [k.key, k.default]));

export const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  ...DEFAULT_KNOBS,
  elements: {},
  implBullets: DEFAULT_IMPL_BULLETS,
  implBulletsLayout: "vertical",
  customElements: [],
};

export function knobsToCss(values: Knobs): string {
  const lines: string[] = [];
  for (const k of KNOBS) {
    const v = values[k.key] ?? k.default;
    const unit = k.unit === "number" || k.unit === "fr" ? "" : k.unit;
    lines.push(`${k.cssVar}: ${v}${unit};`);
  }
  return `:root{${lines.join("")}}`;
}
