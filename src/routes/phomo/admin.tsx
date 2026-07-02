import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/phomo/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Phomo Admin — Super User" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PhomoAdminPage,
});

type Row = Record<string, any>;

function PhomoAdminPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<"checking" | "login" | "denied" | "ready">("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [profiles, setProfiles] = useState<Row[]>([]);
  const [bookings, setBookings] = useState<Row[]>([]);
  const [eventTypes, setEventTypes] = useState<Row[]>([]);
  const [metrics, setMetrics] = useState<{ users: number; bookingsWeek: number; bookingsMonth: number; canceled: number }>({
    users: 0,
    bookingsWeek: 0,
    bookingsMonth: 0,
    canceled: 0,
  });

  const gateAndLoad = async () => {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) {
      setStage("login");
      return;
    }
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", sess.session.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) {
      setStage("denied");
      return;
    }
    await loadAll();
    setStage("ready");
  };

  const loadAll = async () => {
    const [{ data: tps }, { data: bks }, { data: ets }] = await Promise.all([
      supabase.from("team_profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("bookings").select("*").order("start_at", { ascending: false }).limit(100),
      supabase.from("event_types").select("*").order("created_at", { ascending: false }),
    ]);
    setProfiles((tps as Row[]) ?? []);
    setBookings((bks as Row[]) ?? []);
    setEventTypes((ets as Row[]) ?? []);

    const now = Date.now();
    const weekAgo = now - 7 * 864e5;
    const monthAgo = now - 30 * 864e5;
    const list = (bks as Row[]) ?? [];
    setMetrics({
      users: (tps as Row[])?.length ?? 0,
      bookingsWeek: list.filter((b) => new Date(b.start_at).getTime() > weekAgo).length,
      bookingsMonth: list.filter((b) => new Date(b.start_at).getTime() > monthAgo).length,
      canceled: list.filter((b) => b.status === "canceled").length,
    });
  };

  useEffect(() => {
    gateAndLoad();
  }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    await gateAndLoad();
  };

  const cancelBooking = async (id: string) => {
    const { error } = await supabase
      .from("bookings")
      .update({ status: "canceled", canceled_reason: "Canceled by admin" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Booking canceled");
    loadAll();
  };

  const toggleProfile = async (id: string, is_active: boolean) => {
    const { error } = await supabase.from("team_profiles").update({ is_active: !is_active }).eq("id", id);
    if (error) return toast.error(error.message);
    loadAll();
  };

  if (stage === "checking") {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Checking admin access…</div>;
  }

  if (stage === "login") {
    if (typeof window !== "undefined") {
      const returnTo = encodeURIComponent("/phomo/admin");
      window.location.replace(`/phomo/auth?redirect=${returnTo}`);
    }
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Redirecting to sign in…</div>;
  }

  if (stage === "denied") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Toaster />
        <Card className="w-full max-w-sm p-8 text-center">
          <Shield className="mx-auto h-8 w-8 text-destructive" />
          <div className="mt-3 text-lg font-semibold">Access denied</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account is signed in but does not have the admin role.
          </p>
          <Button
            variant="outline"
            className="mt-6 w-full"
            onClick={async () => {
              await supabase.auth.signOut();
              setStage("login");
            }}
          >
            Sign out
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <div className="text-lg font-semibold">Phomo · Super Admin</div>
              <div className="text-xs text-muted-foreground">Full visibility across all users</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={loadAll}>
              Refresh
            </Button>
            <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/phomo" })}>
              Exit to /phomo
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="Team profiles" value={metrics.users} />
          <Metric label="Bookings (7d)" value={metrics.bookingsWeek} />
          <Metric label="Bookings (30d)" value={metrics.bookingsMonth} />
          <Metric label="Canceled" value={metrics.canceled} />
        </div>

        <Card className="p-6">
          <SectionHeader title="All team profiles" count={profiles.length} />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="pb-2">Display name</th>
                  <th className="pb-2">Slug</th>
                  <th className="pb-2">Timezone</th>
                  <th className="pb-2">Active</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="py-2">{p.display_name}</td>
                    <td className="py-2 text-muted-foreground">{p.phomo_slug}</td>
                    <td className="py-2 text-muted-foreground">{p.timezone}</td>
                    <td className="py-2">{p.is_active ? "Yes" : "No"}</td>
                    <td className="py-2 text-right">
                      <Button size="sm" variant="ghost" onClick={() => toggleProfile(p.id, p.is_active)}>
                        {p.is_active ? "Disable" : "Enable"}
                      </Button>
                    </td>
                  </tr>
                ))}
                {profiles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                      No profiles yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6">
          <SectionHeader title="All bookings (last 100)" count={bookings.length} />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="pb-2">Invitee</th>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Start</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-t">
                    <td className="py-2">{b.invitee_name}</td>
                    <td className="py-2 text-muted-foreground">{b.invitee_email}</td>
                    <td className="py-2">{new Date(b.start_at).toLocaleString()}</td>
                    <td className="py-2">{b.status}</td>
                    <td className="py-2 text-right">
                      {b.status !== "canceled" && (
                        <Button size="sm" variant="ghost" onClick={() => cancelBooking(b.id)}>
                          Cancel
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {bookings.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                      No bookings yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6">
          <SectionHeader title="All event types" count={eventTypes.length} />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Duration</th>
                  <th className="pb-2">Slug</th>
                  <th className="pb-2">Active</th>
                </tr>
              </thead>
              <tbody>
                {eventTypes.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="py-2">{e.name}</td>
                    <td className="py-2 text-muted-foreground">{e.duration_minutes} min</td>
                    <td className="py-2 text-muted-foreground">{e.slug}</td>
                    <td className="py-2">{e.is_active ? "Yes" : "No"}</td>
                  </tr>
                ))}
                {eventTypes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-xs text-muted-foreground">
                      No event types yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </Card>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-lg font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground">{count} rows</div>
    </div>
  );
}
