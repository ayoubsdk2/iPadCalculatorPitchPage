import { useState } from "react";
import { X, Send } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultSubject?: string;
  defaultBody?: string;
}

export function EmailDialog({
  open,
  onClose,
  defaultSubject = "Your Phaos AI Voice Agent ROI Snapshot",
  defaultBody = "Hi there,\n\nHere's the calculation we ran together — it shows the real-world impact a Phaos AI Voice Agent would have on your business.\n\nLet me know if you'd like to move forward.\n\n— Phaos AI",
}: Props) {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);

  if (!open) return null;

  const send = async () => {
    if (!to.trim()) {
      toast.error("Add a recipient email address.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(to.trim())) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setSending(true);
    try {
      const { sendTransactionalEmail } = await import("@/lib/email/send-transactional");
      await sendTransactionalEmail({
        templateName: "saved-calculator-share",
        recipientEmail: to.trim(),
        idempotencyKey: `email-dialog-${Date.now()}-${to.trim().toLowerCase()}`,
        templateData: {
          companyName: subject || "your Phaos AI calculation",
          savedAt: new Date().toLocaleString(),
          appUrl: typeof window !== "undefined" ? window.location.origin : "",
          note: body,
        },
      });
      toast.success(`Email sent to ${to}${cc ? ` (cc ${cc})` : ""}`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send email.");
    } finally {
      setSending(false);
    }
  };


  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[560px] rounded-3xl border-4 border-primary/70 bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-primary/30">
          <div className="text-lg font-extrabold uppercase tracking-wide text-foreground">
            Email this calculation
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <Field label="To">
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="customer@example.com"
              className="w-full rounded-lg border-2 border-primary/40 bg-background px-3 py-2 text-base font-semibold focus:outline-none focus:border-primary"
            />
          </Field>
          <Field label="CC (sales rep can CC themselves)">
            <input
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="rep@phaosai.com, manager@phaosai.com"
              className="w-full rounded-lg border-2 border-primary/40 bg-background px-3 py-2 text-base font-semibold focus:outline-none focus:border-primary"
            />
          </Field>
          <Field label="Subject">
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border-2 border-primary/40 bg-background px-3 py-2 text-base font-semibold focus:outline-none focus:border-primary"
            />
          </Field>
          <Field label="Message">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className="w-full rounded-lg border-2 border-primary/40 bg-background px-3 py-2 text-base font-medium focus:outline-none focus:border-primary resize-none"
            />
          </Field>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="rounded-xl border-2 border-primary/40 bg-background px-4 py-2 font-bold text-foreground hover:bg-accent transition"
            >
              Cancel
            </button>
            <button
              onClick={send}
              disabled={sending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 font-extrabold text-primary-foreground hover:opacity-90 transition disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
