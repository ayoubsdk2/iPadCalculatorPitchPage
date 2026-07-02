import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/phomo/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Phomo — Scheduling by Phaos AI" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PhomoDashboard,
});

type TeamProfile = {
  id: string;
  display_name: string;
  phomo_slug: string;
  timezone: string;
  bio: string | null;
};

type Booking = {
  id: string;
  invitee_name: string;
  invitee_email: string;
  start_at: string;
  end_at: string;
  status: string;
};

function PhomoDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        navigate({ to: "/phomo/auth" });
        return;
      }
      const { data: tp } = await supabase
        .from("team_profiles")
        .select("id, display_name, phomo_slug, timezone, bio")
        .eq("user_id", sess.session.user.id)
        .maybeSingle();
      setProfile(tp);
      if (tp) {
        const { data: bk } = await supabase
          .from("bookings")
          .select("id, invitee_name, invitee_email, start_at, end_at, status")
          .eq("team_profile_id", tp.id)
          .order("start_at", { ascending: false })
          .limit(20);
        setBookings((bk as Booking[]) ?? []);
      }
      setLoading(false);
    })();
  }, [navigate]);

  const createProfile = async () => {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) return;
    const cleanSlug = (slug || displayName)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const { data, error } = await supabase
      .from("team_profiles")
      .insert({
        user_id: sess.session.user.id,
        display_name: displayName,
        phomo_slug: cleanSlug,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    toast.success("Phomo profile created");
    setProfile(data as TeamProfile);
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading Phomo…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary" />
            <div>
              <div className="text-lg font-semibold tracking-tight">Phomo</div>
              <div className="text-xs text-muted-foreground">Scheduling · by Phaos AI</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/phomo/admin" className="text-xs text-muted-foreground hover:text-foreground">
              Admin
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/phomo/auth" });
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {!profile ? (
          <Card className="mx-auto max-w-lg p-8">
            <h1 className="text-2xl font-semibold">Welcome to Phomo</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Set up your scheduling profile — this becomes your public booking page.
            </p>
            <div className="mt-6 space-y-3">
              <div>
                <label className="text-xs font-medium">Display name</label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Daniel Lindros" />
              </div>
              <div>
                <label className="text-xs font-medium">Phomo URL</label>
                <div className="flex items-center rounded-md border">
                  <span className="px-3 text-xs text-muted-foreground">phomo.phaosai.com/</span>
                  <Input
                    className="border-0"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="daniel"
                  />
                </div>
              </div>
              <Button className="w-full" disabled={!displayName} onClick={createProfile}>
                Create my Phomo
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="p-6 md:col-span-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">My Phomo</div>
              <div className="mt-2 text-xl font-semibold">{profile.display_name}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                phomo.phaosai.com/{profile.phomo_slug}
              </div>
              <div className="mt-4 text-xs text-muted-foreground">Timezone: {profile.timezone}</div>
              <Button size="sm" className="mt-6 w-full" variant="outline">
                Manage event types
              </Button>
            </Card>

            <Card className="p-6 md:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-lg font-semibold">Upcoming & recent bookings</div>
                <div className="text-xs text-muted-foreground">{bookings.length} shown</div>
              </div>
              {bookings.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No bookings yet. Share your Phomo link to start collecting meetings.
                </div>
              ) : (
                <div className="divide-y">
                  {bookings.map((b) => (
                    <div key={b.id} className="flex items-center justify-between py-3">
                      <div>
                        <div className="text-sm font-medium">{b.invitee_name}</div>
                        <div className="text-xs text-muted-foreground">{b.invitee_email}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm">{new Date(b.start_at).toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">{b.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
