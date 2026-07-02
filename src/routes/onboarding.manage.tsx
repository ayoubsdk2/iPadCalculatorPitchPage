// Public cancel / reschedule surface. Requires the booking's manage_token.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CalendarDays } from "lucide-react";
import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import {
  computeSlots, groupSlotsByDay, formatSlotTime, formatSlotDay, formatFullSlot,
  type AvailabilityWindow, type AvailabilityOverride, type BusyInterval,
} from "@/lib/phomo/availability";

export const Route = createFileRoute("/onboarding/manage")({
  ssr: false,
  validateSearch: (raw: Record<string, unknown>) => ({
    t: typeof raw.t === "string" ? raw.t : "",
  }),
  head: () => ({ meta: [{ title: "Manage your booking" }] }),
  component: ManagePage,
});

type Booking = {
  id: string; invitee_name: string; invitee_email: string;
  start_at: string; end_at: string; status: string;
  invitee_timezone: string; event_type_id: string; team_profile_id: string;
  event_types: { name: string; duration_minutes: number; buffer_before_minutes: number;
    buffer_after_minutes: number; min_notice_minutes: number; max_days_ahead: number };
  team_profiles: { display_name: string; timezone: string };
};

const BROWSER_TZ =
  typeof Intl !== "undefined"
    ? (Intl.DateTimeFormat().resolvedOptions().timeZone ?? "America/New_York")
    : "America/New_York";

function ManagePage() {
  const { t: manageToken } = Route.useSearch();
  const [b, setB] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "cancel" | "reschedule">("view");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<BusyInterval[]>([]);
  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<null | "canceled" | "rescheduled">(null);

  useEffect(() => {
    if (!manageToken) { setErr("Missing management token."); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(`id, invitee_name, invitee_email, start_at, end_at, status, invitee_timezone,
                 event_type_id, team_profile_id,
                 event_types(name, duration_minutes, buffer_before_minutes, buffer_after_minutes, min_notice_minutes, max_days_ahead),
                 team_profiles(display_name, timezone)`)
        .eq("manage_token", manageToken)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) { setErr("We couldn't find this booking. It may have expired."); setLoading(false); return; }
      setB(data as unknown as Booking);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [manageToken]);

  useEffect(() => {
    if (mode !== "reschedule" || !b) return;
    (async () => {
      const [win, ov, bs] = await Promise.all([
        supabase.rpc("phomo_get_availability_windows", { _team_profile_id: b.team_profile_id }),
        supabase.rpc("phomo_get_overrides", {
          _team_profile_id: b.team_profile_id,
          _from: new Date().toISOString().slice(0, 10),
          _to: addDays(new Date(), b.event_types.max_days_ahead).toISOString().slice(0, 10),
        }),
        supabase.rpc("phomo_busy_times", {
          _team_profile_id: b.team_profile_id,
          _from: new Date().toISOString(),
          _to: addDays(new Date(), b.event_types.max_days_ahead).toISOString(),
        }),
      ]);
      setWindows((win.data ?? []) as AvailabilityWindow[]);
      setOverrides((ov.data ?? []) as AvailabilityOverride[]);
      setBusy((bs.data ?? []) as BusyInterval[]);
    })();
  }, [mode, b]);

  const slots = useMemo(() => {
    if (!b) return [] as Date[];
    return computeSlots({
      windows, overrides, busy,
      ctx: {
        timezone: b.team_profiles.timezone,
        durationMinutes: b.event_types.duration_minutes,
        bufferBeforeMinutes: b.event_types.buffer_before_minutes,
        bufferAfterMinutes: b.event_types.buffer_after_minutes,
        minNoticeMinutes: b.event_types.min_notice_minutes,
      },
      days: Math.min(b.event_types.max_days_ahead, 21),
    });
  }, [b, windows, overrides, busy]);
  const grouped = useMemo(
    () => (b ? groupSlotsByDay(slots, b.team_profiles.timezone) : new Map()),
    [slots, b],
  );
  const dayKeys = useMemo(() => Array.from(grouped.keys()) as string[], [grouped]);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  useEffect(() => { if (!activeDay && dayKeys.length) setActiveDay(dayKeys[0]); }, [dayKeys, activeDay]);

  const doCancel = async () => {
    if (!b) return;
    setSaving(true); setErr(null);
    const { data, error } = await supabase.rpc("phomo_cancel_booking", {
      _token: manageToken, _reason: reason.trim() || undefined,
    });
    setSaving(false);
    if (error || !data) return setErr(error?.message ?? "Cancel failed.");
    fetch("/api/public/phomo/notify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manageToken, event: "canceled" }),
    }).catch(() => {});
    setDone("canceled");
  };

  const doReschedule = async () => {
    if (!b || !selectedSlot) return;
    setSaving(true); setErr(null);
    const { data, error } = await supabase.rpc("phomo_reschedule_booking", {
      _token: manageToken, _new_start_at: selectedSlot.toISOString(), _new_timezone: BROWSER_TZ,
    });
    setSaving(false);
    if (error) return setErr(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.manage_token) return setErr("Reschedule failed.");
    fetch("/api/public/phomo/notify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manageToken: row.manage_token, event: "confirmation" }),
    }).catch(() => {});
    window.location.href = `/onboarding/manage?t=${row.manage_token}`;
  };

  if (loading) return <Center><Loader2 className="h-6 w-6 animate-spin text-primary" /></Center>;
  if (err && !b) return <Center><Msg title="Lost in the wilderness?" body={err} /></Center>;
  if (!b) return null;

  const isFinal = b.status === "canceled" || done;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-10 px-4">
      <div className="mx-auto max-w-2xl">
        <Card className="p-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="h-4 w-4" /> {b.event_types.name}
          </div>
          <h1 className="mt-2 text-2xl font-bold">
            {done === "canceled" || b.status === "canceled" ? "Booking canceled" : "Your booking"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatFullSlot(new Date(b.start_at), b.invitee_timezone)} ({b.invitee_timezone})
          </p>
          <p className="mt-1 text-sm text-muted-foreground">With {b.team_profiles.display_name}</p>

          {isFinal ? (
            <div className="mt-6 rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm">
                Rain check received — no worries at all. Life happens, and family and health always come first.
              </p>
              <Link to="/onboarding/schedule" className="mt-4 inline-block text-sm text-primary underline">
                Rebook when you're ready →
              </Link>
            </div>
          ) : mode === "view" ? (
            <div className="mt-6 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setMode("reschedule")}>Reschedule</Button>
              <Button variant="destructive" onClick={() => setMode("cancel")}>Cancel</Button>
            </div>
          ) : mode === "cancel" ? (
            <div className="mt-6 space-y-3">
              <p className="text-sm">Pivot! Let us know why (optional) and we'll take it from here.</p>
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" />
              {err && <div className="rounded-md bg-destructive/10 text-destructive text-xs p-2">{err}</div>}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setMode("view")}>Keep booking</Button>
                <Button variant="destructive" onClick={doCancel} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm cancellation"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="max-h-[380px] overflow-y-auto">
                <div className="mb-2 text-xs uppercase text-muted-foreground">Pick a date</div>
                {dayKeys.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No open dates in the next few weeks.</p>
                ) : dayKeys.map((k) => (
                  <button key={k} onClick={() => { setActiveDay(k); setSelectedSlot(null); }}
                    className={`block w-full text-left rounded-md px-3 py-2 text-sm mb-1 ${
                      activeDay === k ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
                    {formatSlotDay(k, b.team_profiles.timezone)}
                  </button>
                ))}
              </div>
              <div className="max-h-[380px] overflow-y-auto">
                <div className="mb-2 text-xs uppercase text-muted-foreground">Pick a time</div>
                <div className="grid grid-cols-2 gap-2">
                  {(activeDay ? (grouped.get(activeDay) ?? []) : []).map((s: Date) => (
                    <button key={s.toISOString()} onClick={() => setSelectedSlot(s)}
                      className={`rounded-md border px-3 py-2 text-sm ${
                        selectedSlot?.getTime() === s.getTime() ? "border-primary text-primary" : "hover:border-primary/60"}`}>
                      {formatSlotTime(s, BROWSER_TZ)}
                    </button>
                  ))}
                </div>
              </div>
              {err && <div className="col-span-full rounded-md bg-destructive/10 text-destructive text-xs p-2">{err}</div>}
              <div className="col-span-full flex gap-2">
                <Button variant="ghost" onClick={() => setMode("view")}>Back</Button>
                <Button onClick={doReschedule} disabled={!selectedSlot || saving} className="flex-1">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : selectedSlot
                    ? `Reschedule to ${formatInTimeZone(selectedSlot, BROWSER_TZ, "MMM d, h:mm a")}`
                    : "Choose a new time"}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-background">{children}</div>;
}
function Msg({ title, body }: { title: string; body: string }) {
  return (
    <div className="max-w-md text-center px-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      <Link to="/" className="mt-4 inline-block text-sm text-primary underline">Go home</Link>
    </div>
  );
}
