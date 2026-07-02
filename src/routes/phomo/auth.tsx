import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export const Route = createFileRoute("/phomo/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in · Phomo by Phaos AI" },
      { name: "description", content: "Sign in or create your Phomo scheduling account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PhomoAuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function PhomoAuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate({ to: "/phomo" });
      } else {
        setChecking(false);
      }
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        toast.success("Welcome back");
        navigate({ to: "/phomo" });
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error("Password must be at least 8 characters");
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/phomo` },
        });
        if (error) throw error;
        toast.success("Account created — check your email to verify, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/phomo/reset-password`,
        });
        if (error) throw error;
        toast.success("Reset link sent — check your inbox.");
        setMode("signin");
      }
    } catch (err: any) {
      toast.error(err?.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center px-4 py-12">
      <Toaster richColors closeButton position="top-center" />
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div
              className="h-11 w-11 rounded-2xl shadow-lg"
              style={{ background: "var(--gradient-primary)" }}
            />
            <div className="text-left">
              <div className="text-2xl font-black tracking-tight text-foreground">Phomo</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground -mt-0.5">
                Scheduling · by Phaos AI
              </div>
            </div>
          </div>
          <h1 className="text-xl font-bold text-foreground">
            {mode === "signin" && "Welcome back"}
            {mode === "signup" && "Create your account"}
            {mode === "forgot" && "Reset your password"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin" && "Sign in to manage your scheduling."}
            {mode === "signup" && "Start booking meetings in minutes."}
            {mode === "forgot" && "We'll email you a secure link."}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-xl p-6 sm:p-8">
          {/* Toggle */}
          {mode !== "forgot" && (
            <div className="mb-5 flex rounded-lg bg-muted/60 p-1 text-sm font-semibold">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={`flex-1 rounded-md py-2 transition ${
                  mode === "signin"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Current Login
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`flex-1 rounded-md py-2 transition ${
                  mode === "signup"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="mt-1.5 w-full h-11 rounded-lg border-2 border-border bg-background px-3.5 text-sm font-medium focus:outline-none focus:border-primary transition"
              />
            </div>

            {mode !== "forgot" && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Password
                  </label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative mt-1.5">
                  <input
                    type={showPw ? "text" : "password"}
                    required
                    minLength={mode === "signup" ? 8 : undefined}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "signup" ? "Min. 8 characters" : "••••••••"}
                    className="w-full h-11 rounded-lg border-2 border-border bg-background pl-3.5 pr-11 text-sm font-medium focus:outline-none focus:border-primary transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground rounded-md"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full h-11 rounded-lg font-bold text-primary-foreground shadow-lg hover:opacity-95 disabled:opacity-60 transition flex items-center justify-center gap-2"
              style={{ background: "var(--gradient-primary)" }}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" && "Sign In"}
              {mode === "signup" && "Create Account"}
              {mode === "forgot" && "Send Reset Link"}
            </button>

            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                ← Back to sign in
              </button>
            )}
          </form>
        </div>

        {/* Footer links */}
        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <a href="https://www.phaosai.com" className="hover:text-foreground">phaosai.com</a>
          <span>·</span>
          <a href="https://voice.phaosai.com" className="hover:text-foreground">voice.phaosai.com</a>
          <span>·</span>
          <Link to="/phomo/admin" className="hover:text-foreground">Admin</Link>
        </div>
      </div>
    </div>
  );
}
