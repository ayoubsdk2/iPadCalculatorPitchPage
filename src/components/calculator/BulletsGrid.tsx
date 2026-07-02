import crownUrl from "@/assets/phaos-crown.png";

// Reveal order: TL, ML, BL, TR, MR, BR
// Each entry maps a reveal index to its grid cell (col, row).
const BULLETS: { label: string; col: number; row: number }[] = [
  { label: "Based on 2 minutes per call avg.", col: 1, row: 1 }, // TL
  { label: "Capture after hours + weekends",   col: 1, row: 2 }, // ML
  { label: "Redirect staff focus & efforts", col: 1, row: 3 }, // BL
  { label: "AI customizable answer times",   col: 2, row: 1 }, // TR
  { label: "Email summary after calls",      col: 2, row: 2 }, // MR
  { label: "Answer several calls at once",   col: 2, row: 3 }, // BR
];

export function BulletsGrid({ visible, count }: { visible: boolean; count?: number }) {
  const shown = count ?? (visible ? BULLETS.length : 0);
  return (
    <div
      className="grid grid-cols-2 grid-rows-3 gap-x-5 gap-y-0 w-full h-full content-stretch items-start justify-items-start"
    >
      {BULLETS.map((b, i) => {
        const isVisible = i < shown;
        return (
          <div
            key={b.label}
            className="flex items-center gap-1.5 text-left min-w-0 whitespace-nowrap"
            style={{ gridColumn: b.col, gridRow: b.row, visibility: isVisible ? "visible" : "hidden" }}
            aria-hidden={!isVisible}
          >
            <img
              src={crownUrl}
              alt=""
              aria-hidden
              className="h-5 w-5 shrink-0 object-contain"
              draggable={false}
            />
            <span className="text-[1.02rem] min-[1100px]:text-[1.2rem] font-extrabold text-foreground leading-tight whitespace-nowrap">
              {b.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
