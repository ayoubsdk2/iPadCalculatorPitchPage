import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/admin/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Admin · Phaos AI" }, { name: "robots", content: "noindex" }] }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.href = "/?adminEdit=1";
      else setChecking(false);
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/admin/editor` },
        });
        if (error) throw error;
        toast.success("Account created. Granting admin access…");
        const mod = await import("@/lib/admin.functions");
        const res = await mod.bootstrapAdmin();
        if (!res.ok) toast.error(res.message || "Could not grant admin");
        else toast.success("You are admin. Loading editor…");
        window.location.href = "/?adminEdit=1";
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/?adminEdit=1";
      }
    } catch (err: any) {
      toast.error(err?.message || "Auth failed");
    } finally {
      setBusy(false);
    }
  };

  if (checking) return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Toaster richColors closeButton position="top-center" />
      <div className="w-full max-w-sm rounded-2xl border-2 border-primary/40 bg-background p-6 shadow-xl">
        <div className="mb-5 text-center">
          <div className="text-2xl font-black text-primary">Phaos AI · Admin</div>
          <div className="mt-1 text-xs text-muted-foreground">Sign in to edit the consult page</div>
        </div>

        <div className="mb-4 flex rounded-lg border border-border p-1 text-sm font-bold">
          <button onClick={() => setMode("signin")} className={`flex-1 rounded-md py-1.5 ${mode === "signin" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Sign In</button>
          <button onClick={() => setMode("signup")} className={`flex-1 rounded-md py-1.5 ${mode === "signup" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Sign Up</button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full h-11 rounded-lg border-2 border-border bg-background px-3 text-sm font-semibold focus:outline-none focus:border-primary"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full h-11 rounded-lg border-2 border-border bg-background px-3 text-sm font-semibold focus:outline-none focus:border-primary"
          />
          <button type="submit" disabled={busy} className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-extrabold hover:opacity-90 disabled:opacity-60">
            {busy ? "Please wait…" : mode === "signup" ? "Create Admin Account" : "Sign In"}
          </button>
        </form>

        {mode === "signup" && (
          <p className="mt-3 text-[11px] text-muted-foreground text-center leading-snug">
            The first signup automatically gets admin rights. Use this once for <strong>daniel@phaosai.com</strong>, then sign in normally.
          </p>
        )}

        <div className="mt-5 text-center text-xs">
          <Link to="/" className="text-muted-foreground hover:text-foreground underline">← Back to calculator</Link>
        </div>
      </div>
    </div>
  );
}
