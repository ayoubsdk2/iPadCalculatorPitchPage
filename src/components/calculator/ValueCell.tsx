interface Props {
  title: string;
  value: number | null;
  prefix?: string;
  suffix?: string;
  readOnly?: boolean;
  highlight?: boolean;
  placeholder?: string;
  onClick?: () => void;
}

function fmt(value: number | null, prefix?: string, suffix?: string, placeholder = "—") {
  if (value === null || value === undefined || Number.isNaN(value)) return placeholder;
  const formatted = value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return `${prefix ?? ""}${formatted}${suffix ? ` ${suffix}` : ""}`;
}

export function ValueCell({
  title,
  value,
  prefix,
  suffix,
  readOnly,
  highlight,
  placeholder = "Tap",
  onClick,
}: Props) {
  const empty = value === null || value === undefined;
  return (
    <button
      type="button"
      onClick={readOnly ? undefined : onClick}
      disabled={readOnly}
      className={[
        "group relative w-full h-full text-center rounded-[1.35rem] border-2 bg-background",
        "flex flex-col items-center justify-center gap-0 px-1.5 py-1",
        readOnly
          ? "border-primary/40 cursor-default"
          : "border-primary/70 hover:border-primary active:scale-[0.995] cursor-pointer",
        highlight ? "ring-2 ring-[oklch(0.85_0.18_95)]" : "",
      ].join(" ")}
    >
      <div className="text-[1.08rem] min-[1100px]:text-[1.48rem] font-extrabold text-foreground leading-tight">
        {title}
      </div>
      <div
        className={[
          "tabular-nums leading-none font-black",
          empty
            ? "text-muted-foreground/50 text-base font-semibold"
            : "text-[2.75rem] min-[1100px]:text-[3.65rem] text-foreground",
        ].join(" ")}
      >
        {empty ? placeholder : fmt(value, prefix, suffix)}
      </div>
    </button>
  );
}
