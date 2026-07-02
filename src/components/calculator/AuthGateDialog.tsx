import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  title?: string;
  onClose: () => void;
  onAuthorized: () => void;
}

type Mode = "login" | "signup" | "forgot";

const REMEMBER_KEY = "phaos.auth.remember.until";
const REMEMBER_EMAIL_KEY = "phaos.auth.remember.email";

export function isAuthGateValid(): boolean {
  if (typeof window === "undefined") return false;
  const v = window.localStorage.getItem(REMEMBER_KEY);
  if (!v) return false;
  const until = Number(v);
  return Number.isFinite(until) && until > Date.now();
}

function setRemembered(email: string) {
  const until = Date.now() + 24 * 60 * 60 * 1000;
  window.localStorage.setItem(REMEMBER_KEY, String(until));
  window.localStorage.setItem(REMEMBER_EMAIL_KEY, email);
}

export function AuthGateDialog({ open, title = "Sign in to continue", onClose, onAuthorized }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setMode("login");
    setPassword("");
    setShowPassword(false);
    const savedEmail = window.localStorage.getItem(REMEMBER_EMAIL_KEY) ?? "";
    setEmail(savedEmail);
    setTimeout(() => {
      if (savedEmail && passRef.current) passRef.current.focus();
      else emailRef.current?.focus();
    }, 50);
  }, [open]);

  if (!open) return null;

  const doLogin = async () => {
    if (!email || !password) { toast.error("Enter email and password."); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (remember) setRemembered(email);
    toast.success("Signed in.");
    onAuthorized();
  };

  const doSignup = async () => {
    if (!email || !password) { toast.error("Enter email and password."); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters."); return; }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (remember) setRemembered(email);
    toast.success("Account created. Check email to verify if required.");
    onAuthorized();
  };

  const doForgot = async () => {
    if (!email) { toast.error("Enter the email to reset."); return; }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Reset code/link sent to ${email}.`);
    setMode("login");
  };

  const handleEnter = () => {
    if (busy) return;
    if (mode === "login") doLogin();
    else if (mode === "signup") doSignup();
    else doForgot();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      data-no-stage-tap
      onClick={onClose}
    >
      <div
        className="w-full max-w-[460px] rounded-3xl border-4 border-primary/70 bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-primary/30">
          <div className="text-lg font-extrabold uppercase tracking-wide text-foreground">
            {title}
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-border">
          <TabBtn active={mode === "login"} onClick={() => setMode("login")}>Log In</TabBtn>
          <TabBtn active={mode === "signup"} onClick={() => setMode("signup")}>Sign Up</TabBtn>
          <TabBtn active={mode === "forgot"} onClick={() => setMode("forgot")}>Forgot</TabBtn>
        </div>

        <form
          className="p-6 flex flex-col gap-4"
          onSubmit={(e) => { e.preventDefault(); handleEnter(); }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Username / Email</span>
            <input
              ref={emailRef}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border-2 border-primary/40 bg-background px-3 py-2 text-base font-semibold focus:outline-none focus:border-primary"
            />
          </label>

          {mode !== "forgot" && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Password</span>
              <div className="flex items-center rounded-lg border-2 border-primary/40 bg-background focus-within:border-primary">
                <input
                  ref={passRef}
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent px-3 py-2 text-base font-semibold outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="px-3 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </label>
          )}

          {mode !== "forgot" && (
            <label className="inline-flex items-center gap-2 text-sm font-bold text-foreground select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Remember me for 24 hours
            </label>
          )}

          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-primary px-5 py-3 text-base font-extrabold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Please wait…" : mode === "login" ? "Log In" : mode === "signup" ? "Create Account" : "Send Reset Email"}
          </button>
        </form>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-3 text-sm font-extrabold uppercase tracking-wide transition ${
        active ? "text-primary border-b-2 border-primary -mb-px" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
