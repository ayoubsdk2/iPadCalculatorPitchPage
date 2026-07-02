import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/superadmin/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Superadmin · Phaos AI" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SuperadminLoginPage,
});

function SuperadminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const { data: roleRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.session.user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (roleRow) {
          window.location.href = "/?superadminEdit=1";
          return;
        }
      }
      setChecking(false);
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    try {
      // Bootstrap endpoint is token-protected and no longer callable from the client.


      const { data: signIn, error: signInErr } =
        await supabase.auth.signInWithPassword({ email, password });
      if (signInErr || !signIn.session) {
        throw signInErr ?? new Error("Sign-in failed.");
      }

      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", signIn.session.user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleRow) {
        toast.error("This account does not have admin access.");
        return;
      }

      window.location.href = "/?superadminEdit=1";
    } catch (err: any) {
      toast.error(err?.message || "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Toaster richColors closeButton position="top-center" />
      <div className="w-full max-w-sm rounded-2xl border-2 border-primary/40 bg-background p-6 shadow-xl">
        <div className="mb-5 text-center">
          <div className="text-2xl font-black text-primary">Phaos AI · Superadmin</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Simple cell mover &amp; resizer
          </div>
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
          <button
            type="submit"
            disabled={busy}
            className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-extrabold hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div className="mt-5 text-center text-xs">
          <Link to="/" className="text-muted-foreground hover:text-foreground underline">
            ← Back to calculator
          </Link>
        </div>
      </div>
    </div>
  );
}
