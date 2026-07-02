import type { CellKey } from "./store";

export const CELL_QUOTES: Partial<Record<CellKey, { quote: string; source: string }>> = {
  monthlyCalls: {
    quote: "Over 40% of Inbound Inquiries Arrive 'Off the Clock'",
    source: "Blazeo",
  },
  missedCalls: {
    quote: "62% of Business Calls Go Unanswered",
    source: "411 Locals",
  },
  missedBookings: {
    quote: "78% of Deals Go to the First Responder",
    source: "MIT Sloan School of Management",
  },
  callbackTime: {
    quote: "Responding within 60 seconds yields a 391% higher conversion rate",
    source: "Velocify",
  },
  estAIBookings: {
    quote: "85% of unanswered callers will not leave a voicemail",
    source: "PATLive",
  },
  refocusedStaff: {
    quote: "Missed calls cost the average SMB $126,000 annually",
    source: "411 Locals & Aira",
  },
};

interface Props {
  cellKey: CellKey | null;
  onDismiss: () => void;
}

export function StatQuoteDialog({ cellKey, onDismiss }: Props) {
  if (!cellKey) return null;
  const data = CELL_QUOTES[cellKey];
  if (!data) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onDismiss}
      data-no-stage-tap
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm cursor-pointer"
    >
      <div
        className="w-[75vw] h-[75vh] rounded-3xl border-4 border-primary bg-background flex flex-col items-center justify-center text-center px-[5vw] py-[4vh]"
      >
        <div
          className="font-black text-foreground leading-tight"
          style={{ fontSize: "clamp(1.6rem, 4.5vw, 4rem)" }}
        >
          &ldquo;{data.quote}&rdquo;
        </div>
        <div
          className="mt-[3vh] font-bold italic text-primary"
          style={{ fontSize: "clamp(1.1rem, 3vw, 2.4rem)" }}
        >
          —{data.source}
        </div>
      </div>
    </div>
  );
}
