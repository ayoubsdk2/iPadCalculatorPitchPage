import { useEffect, useState } from "react";
import { Check, Delete, X } from "lucide-react";

interface Props {
  open: boolean;
  label: string;
  initialValue: number | null;
  suffix?: string; // "$" "%" "hrs" etc.
  prefix?: string;
  allowDecimal?: boolean;
  emptyAsZero?: boolean;
  onCommit: (value: number | null) => void;
  onClose: () => void;
}

export function NumericKeypad({
  open,
  label,
  initialValue,
  suffix,
  prefix,
  allowDecimal = true,
  emptyAsZero = false,
  onCommit,
  onClose,
}: Props) {
  const [buf, setBuf] = useState<string>("");

  useEffect(() => {
    if (open) {
      if (initialValue === null || initialValue === undefined) {
        setBuf(emptyAsZero ? "0" : "");
      } else {
        setBuf(String(initialValue));
      }
    }
  }, [open, initialValue, emptyAsZero]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        setBuf((b) => (b.length >= 12 ? b : b + e.key));
      } else if (e.key === "." && allowDecimal) {
        e.preventDefault();
        setBuf((b) => (b.includes(".") ? b : b === "" ? "0." : b + "."));
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setBuf((b) => b.slice(0, -1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, buf, allowDecimal]);

  if (!open) return null;

  const press = (k: string) => {
    if (k === "DEL") return setBuf((b) => b.slice(0, -1));
    if (k === "CLR") return setBuf("");
    if (k === ".") return setBuf((b) => (b.includes(".") ? b : b === "" ? "0." : b + "."));
    setBuf((b) => (b.length >= 12 ? b : b + k));
  };

  const commit = () => {
    if (buf === "") {
      onCommit(emptyAsZero ? 0 : null);
      return;
    }
    const n = Number(buf);
    onCommit(Number.isFinite(n) ? n : null);
  };

  const displayValue = buf === "" ? "0" : buf;

  const keys: { k: string; label?: React.ReactNode; cls?: string }[] = [
    { k: "7" },
    { k: "8" },
    { k: "9" },
    { k: "4" },
    { k: "5" },
    { k: "6" },
    { k: "1" },
    { k: "2" },
    { k: "3" },
    { k: "0" },
    { k: ".", label: allowDecimal ? "." : "" },
    { k: "DEL", label: <Delete className="h-7 w-7" />, cls: "bg-muted hover:bg-muted/80" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={() => {
        commit();
      }}
    >
      <div
        className="w-full max-w-[640px] rounded-3xl border-4 border-primary/70 bg-background shadow-[0_30px_80px_-20px_rgba(0,0,0,0.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-primary/30">
          <div className="text-base font-bold uppercase tracking-wide text-foreground">
            {label}
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-muted transition"
            aria-label="Close keypad"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 pt-6">
          <div className="flex items-baseline justify-end gap-2 rounded-2xl border-2 border-primary/40 bg-surface px-6 py-5 min-h-[88px]">
            {prefix ? <span className="text-3xl font-bold text-muted-foreground">{prefix}</span> : null}
            <span className="text-5xl sm:text-6xl font-extrabold text-foreground tabular-nums" style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}>
              {displayValue}
            </span>
            {suffix ? (
              <span className="text-2xl font-bold text-muted-foreground">{suffix}</span>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 p-6">
          {keys.map((kk) => (
            <button
              key={kk.k}
              onClick={() => press(kk.k)}
              className={`h-16 sm:h-20 rounded-2xl border-2 border-primary/30 text-2xl font-bold transition active:scale-95 ${
                kk.cls ?? "bg-background hover:bg-accent"
              }`}
            >
              {kk.label ?? kk.k}
            </button>
          ))}
          <button
            onClick={() => press("CLR")}
            className="col-span-1 h-16 sm:h-20 rounded-2xl border-2 border-destructive/40 bg-destructive/10 text-destructive text-lg font-bold hover:bg-destructive/20 transition"
          >
            Clear
          </button>
          <button
            onClick={commit}
            className="col-span-2 h-16 sm:h-20 rounded-2xl bg-[oklch(0.65_0.18_155)] text-white text-xl font-extrabold shadow-lg hover:opacity-90 transition flex items-center justify-center gap-2"
          >
            <Check className="h-6 w-6" /> Enter
          </button>
        </div>
      </div>
    </div>
  );
}
