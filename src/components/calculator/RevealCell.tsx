interface Props {
  title: string;
  value: string;
  revealed: boolean;
  onReveal: () => void;
  highlight?: boolean;
  borderless?: boolean;
  compact?: boolean;
  valueClassName?: string;
}

export function RevealCell({
  title,
  value,
  revealed,
  onReveal,
  highlight,
  borderless,
  compact,
  valueClassName,
}: Props) {
  return (
    <button
      type="button"
      onClick={!revealed ? onReveal : undefined}
      data-no-stage-tap
      className={[
        "relative w-full h-full px-1 py-0.5",
        "flex flex-col items-center justify-center text-center bg-background",
        borderless
          ? ""
          : "rounded-2xl border-2 " +
            (revealed ? "border-primary/40" : "border-primary/70 cursor-pointer"),
        highlight && !revealed && !borderless ? "ring-2 ring-[oklch(0.85_0.18_95)]" : "",
      ].join(" ")}
    >
      <div className="text-[1.25rem] min-[1100px]:text-[1.6rem] font-extrabold uppercase text-foreground leading-tight">
        {title}
      </div>
      <div
        className={[
          "tabular-nums leading-none font-black mt-1",
          compact
            ? `text-[3.4rem] min-[1100px]:text-[3.95rem] ${valueClassName ?? "text-primary"}`
            : `text-4xl sm:text-5xl lg:text-6xl ${valueClassName ?? "text-primary"}`,
          revealed ? "" : "select-none",
        ].join(" ")}
        style={
          revealed
            ? undefined
            : { filter: "blur(16px)", opacity: 0.55, pointerEvents: "none" }
        }
        aria-hidden={!revealed}
      >
        {value}
      </div>
      {!revealed && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="rounded-full bg-primary/90 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-lg">
            Tap to reveal
          </span>
        </div>
      )}
    </button>
  );
}
