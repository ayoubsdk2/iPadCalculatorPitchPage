import { useEffect, useState } from "react";
import { Check, Delete, X } from "lucide-react";

interface Props {
  open: boolean;
  label: string;
  initialValue: string;
  placeholder?: string;
  shortcuts?: string[];
  /** When true: buffer stays lowercase, `@` key appears, and domain shortcuts append (not commit). */
  emailMode?: boolean;
  onCommit: (value: string) => void;
  onClose: () => void;
}

const DEFAULT_SHORTCUTS = ["STAFF", "OWNER"];
const EMAIL_SHORTCUTS = ["@gmail.com", "@yahoo.com", "@hotmail.com", "@outlook.com"];

const ROW_NUM = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const ROW_TOP = ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"];
const ROW_MID = ["A", "S", "D", "F", "G", "H", "J", "K", "L"];
const ROW_BOT = ["Z", "X", "C", "V", "B", "N", "M"];

export function QwertyKeyboard({ open, label, initialValue, placeholder, shortcuts, emailMode, onCommit, onClose }: Props) {
  const [buf, setBuf] = useState("");

  useEffect(() => {
    if (open) {
      setBuf(emailMode ? (initialValue ?? "").toLowerCase() : (initialValue ?? "").toUpperCase());
    }
  }, [open, initialValue, emailMode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onCommit(emailMode ? buf.trim().toLowerCase() : buf.trim().toUpperCase());
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setBuf((b) => b.slice(0, -1));
      } else if (e.key.length === 1) {
        e.preventDefault();
        const ch = emailMode ? e.key.toLowerCase() : e.key.toUpperCase();
        setBuf((b) => (b.length >= 80 ? b : b + ch));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, buf, emailMode, onCommit, onClose]);

  if (!open) return null;

  const typeKey = (k: string) => {
    const ch = emailMode ? k.toLowerCase() : k.toUpperCase();
    setBuf((b) => (b.length >= 80 ? b : b + ch));
  };
  const appendRaw = (s: string) => {
    setBuf((b) => (b.length + s.length > 120 ? b : b + s));
  };

  const commit = () => onCommit(emailMode ? buf.trim().toLowerCase() : buf.trim().toUpperCase());
  const bufClass = emailMode
    ? "text-3xl sm:text-4xl font-extrabold text-foreground break-all"
    : "text-3xl sm:text-4xl font-extrabold text-foreground break-all uppercase";

  const Key = ({ ch, onClick, className = "", children }: { ch?: string; onClick?: () => void; className?: string; children?: React.ReactNode }) => (
    <button
      onClick={onClick ?? (() => ch && typeKey(ch))}
      className={`h-14 sm:h-16 min-w-[2.5rem] flex-1 rounded-xl border-2 border-primary/30 bg-background text-2xl font-bold hover:bg-accent transition active:scale-95 ${className}`}
    >
      {children ?? (emailMode ? ch?.toLowerCase() : ch?.toUpperCase())}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={commit}
    >
      <div
        className="w-full max-w-[920px] rounded-3xl border-4 border-primary/70 bg-background shadow-[0_30px_80px_-20px_rgba(0,0,0,0.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-primary/30">
          <div className="text-base font-bold uppercase tracking-wide text-foreground">{label}</div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted transition" aria-label="Close keyboard">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 pt-6">
          <div className="flex items-center rounded-2xl border-2 border-primary/40 bg-surface px-6 py-5 min-h-[88px]">
            <span
              className={bufClass}
              style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}
            >
              {buf || <span className="text-muted-foreground/60 normal-case">{placeholder ?? ""}</span>}
            </span>
            <span className="ml-1 inline-block h-8 w-[3px] bg-primary animate-pulse" />
          </div>
          {(() => {
            const list = emailMode ? EMAIL_SHORTCUTS : (shortcuts ?? DEFAULT_SHORTCUTS);
            const useAppend = emailMode;
            const rows: string[][] = list.length <= 6 ? [list] : (() => {
              const total = list.reduce((s, x) => s + Math.max(x.length, 3), 0);
              const target = total / 3;
              const out: string[][] = [[], [], []];
              let ri = 0;
              let acc = 0;
              for (let i = 0; i < list.length; i++) {
                const len = Math.max(list[i].length, 3);
                if (ri < 2 && acc + len / 2 > target) { ri++; acc = 0; }
                out[ri].push(list[i]);
                acc += len;
              }
              return out;
            })();
            return rows.map((row, idx) => (
              <div key={idx} className="flex gap-2 pt-2">
                {row.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => (useAppend ? appendRaw(s) : onCommit(s))}
                    style={{ flexGrow: Math.max(s.length, 3) }}
                    className="h-11 px-3 rounded-xl bg-primary text-primary-foreground text-sm sm:text-base font-extrabold tracking-wide shadow hover:opacity-90 transition active:scale-95 whitespace-nowrap flex-1 basis-0"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ));
          })()}
        </div>

        <div className="flex flex-col gap-2 p-4 sm:p-6">
          <div className="flex gap-2">
            {ROW_NUM.map((k) => <Key key={k} ch={k}>{k}</Key>)}
          </div>
          <div className="flex gap-2">
            {ROW_TOP.map((k) => <Key key={k} ch={k} />)}
          </div>
          <div className="flex gap-2 px-[2.5%]">
            {ROW_MID.map((k) => <Key key={k} ch={k} />)}
          </div>
          <div className="flex gap-2">
            <Key onClick={() => setBuf("")} className="bg-destructive text-destructive-foreground hover:opacity-90 border-destructive text-base">CLEAR</Key>
            {ROW_BOT.map((k) => <Key key={k} ch={k} />)}
            <Key onClick={() => setBuf((b) => b.slice(0, -1))} className="bg-muted hover:bg-muted/80"><Delete className="h-6 w-6 mx-auto" /></Key>
          </div>
          <div className="flex gap-2">
            <Key onClick={() => typeKey(" ")} className={emailMode ? "flex-[4]" : "flex-[6]"}>SPACE</Key>
            {emailMode && <Key onClick={() => appendRaw("@")}>@</Key>}
            <Key onClick={() => typeKey(".")}>.</Key>
            <button
              onClick={commit}
              className="h-14 sm:h-16 flex-[3] rounded-xl bg-[oklch(0.65_0.18_155)] text-white text-xl font-extrabold shadow-lg hover:opacity-90 transition flex items-center justify-center gap-2"
            >
              <Check className="h-6 w-6" /> ENTER
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
