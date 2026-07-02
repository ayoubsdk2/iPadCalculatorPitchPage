// Public post-Stripe onboarding scheduler.
// - Loads the first `is_onboarding` public event type + host availability.
// - Computes free slots client-side against availability + busy times.
// - Books via `phomo_create_booking` RPC and emails confirmation via
//   /api/public/phomo/notify.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import {
  computeSlots,
  groupSlotsByDay,
  formatSlotTime,
  formatSlotDay,
  formatFullSlot,
  type AvailabilityWindow,
  type AvailabilityOverride,
  type BusyInterval,
} from "@/lib/phomo/availability";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CalendarDays, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/onboarding/schedule")({
  ssr: false,
  validateSearch: (raw: Record<string, unknown>) => ({
    id: typeof raw.id === "string" ? raw.id : "",
    event: typeof raw.event === "string" ? raw.event : "",
  }),
  head: () => ({ meta: [{ title: "Book your Phaos AI onboarding" }] }),
  component: SchedulerPage,
});

type EventCtx = {
  event_type_id: string;
  event_name: string;
  duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_notice_minutes: number;
  max_days_ahead: number;
  location_type: string;
  team_profile_id: string;
  team_display_name: string;
  team_timezone: string;
};

const BROWSER_TZ =
  typeof Intl !== "undefined"
    ? (Intl.DateTimeFormat().resolvedOptions().timeZone ?? "America/New_York")
    : "America/New_York";

function SchedulerPage() {
  const { id: onboardingId, event: eventOverride } = Route.useSearch();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<EventCtx | null>(null);
  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([]);
  const [busy, setBusy] = useState<BusyInterval[]>([]);

  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [inviteeName, setInviteeName] = useState("");
  const [inviteeEmail, setInviteeEmail] = useState("");
  const [inviteeNotes, setInviteeNotes] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookErr, setBookErr] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    manageToken: string; whenLabel: string; hostTz: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let eventTypeId = eventOverride;
        if (!eventTypeId) {
          const { data: et, error } = await supabase
            .from("event_types")
            .select("id")
            .eq("is_onboarding", true)
            .eq("is_active", true)
            .eq("is_public", true)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (error) throw error;
          if (!et) throw new Error("No onboarding event type is published yet.");
          eventTypeId = et.id;
        }
        const { data: ctxRow, error: ctxErr } = await supabase.rpc(
          "phomo_get_event_context",
          { _event_type_id: eventTypeId },
        );
        if (ctxErr) throw ctxErr;
        const first = Array.isArray(ctxRow) ? ctxRow[0] : ctxRow;
        if (!first) throw new Error("This booking link is no longer active.");
        if (cancelled) return;
        setCtx(first as EventCtx);

        const [win, ov, busyRes] = await Promise.all([
          supabase.rpc("phomo_get_availability_windows", { _team_profile_id: first.team_profile_id }),
          supabase.rpc("phomo_get_overrides", {
            _team_profile_id: first.team_profile_id,
            _from: new Date().toISOString().slice(0, 10),
            _to: addDays(new Date(), first.max_days_ahead).toISOString().slice(0, 10),
          }),
          supabase.rpc("phomo_busy_times", {
            _team_profile_id: first.team_profile_id,
            _from: new Date().toISOString(),
            _to: addDays(new Date(), first.max_days_ahead).toISOString(),
          }),
        ]);
        if (win.error) throw win.error;
        if (ov.error) throw ov.error;
        if (busyRes.error) throw busyRes.error;
        if (cancelled) return;
        setWindows((win.data ?? []) as AvailabilityWindow[]);
        setOverrides((ov.data ?? []) as AvailabilityOverride[]);
        setBusy((busyRes.data ?? []) as BusyInterval[]);
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message ?? "Unable to load scheduler.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [eventOverride]);

  const slots = useMemo(() => {
    if (!ctx) return [] as Date[];
    return computeSlots({
      windows, overrides, busy,
      ctx: {
        timezone: ctx.team_timezone,
        durationMinutes: ctx.duration_minutes,
        bufferBeforeMinutes: ctx.buffer_before_minutes,
        bufferAfterMinutes: ctx.buffer_after_minutes,
        minNoticeMinutes: ctx.min_notice_minutes,
        slotStepMinutes: 30,
      },
      days: Math.min(ctx.max_days_ahead, 21),
    });
  }, [ctx, windows, overrides, busy]);

  const grouped = useMemo(
    () => (ctx ? groupSlotsByDay(slots, ctx.team_timezone) : new Map<string, Date[]>()),
    [slots, ctx],
  );
  const dayKeys = useMemo(() => Array.from(grouped.keys()), [grouped]);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  useEffect(() => { if (!activeDay && dayKeys.length) setActiveDay(dayKeys[0]); }, [dayKeys, activeDay]);

  const canBook = inviteeName.trim().length > 0
    && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(inviteeEmail.trim())
    && selectedSlot && ctx;

  const submitBooking = async () => {
    if (!canBook || !ctx || !selectedSlot) return;
    setBooking(true);
    setBookErr(null);
    try {
      const { data, error } = await supabase.rpc("phomo_create_booking", {
        _event_type_id: ctx.event_type_id,
        _invitee_name: inviteeName.trim(),
        _invitee_email: inviteeEmail.trim().toLowerCase(),
        _invitee_notes: inviteeNotes.trim(),
        _start_at: selectedSlot.toISOString(),
        _invitee_timezone: BROWSER_TZ,
        _pending_onboarding_id: onboardingId || undefined,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.manage_token) throw new Error("Booking did not return a manage token.");
      // Fire-and-forget confirmation email
      fetch("/api/public/phomo/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manageToken: row.manage_token, event: "confirmation" }),
      }).catch(() => {});
      setConfirmation({
        manageToken: row.manage_token,
        whenLabel: formatFullSlot(selectedSlot, ctx.team_timezone),
        hostTz: ctx.team_timezone,
      });
    } catch (e: any) {
      setBookErr(e?.message ?? "We couldn't lock that slot. Please try another time.");
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (loadError || !ctx) {
    return (
      <ShellCard>
        <h1 className="text-2xl font-semibold">We hit a snag loading the scheduler.</h1>
        <p className="mt-2 text-sm text-muted-foreground">{loadError ?? "Please refresh and try again."}</p>
        <Link to="/" className="mt-4 inline-block text-sm text-primary underline">Return home</Link>
      </ShellCard>
    );
  }

  if (confirmation) {
    return (
      <ShellCard>
        <CheckCircle2 className="h-14 w-14 text-primary mb-4" />
        <h1 className="text-3xl font-bold tracking-tight">It's official! Phomo cured.</h1>
        <p className="mt-3 text-muted-foreground">
          We're locked in for <strong>{confirmation.whenLabel}</strong>
          <span className="text-muted-foreground/80"> ({confirmation.hostTz})</span>.
          Check your inbox for the golden ticket — the calendar invite is on its way.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            to="/onboarding/manage"
            search={{ t: confirmation.manageToken }}
            className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-accent"
          >
            Manage this booking
          </Link>
          <a href="https://www.phaosai.com" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
            Back to Phaos AI
          </a>
        </div>
      </ShellCard>
    );
  }

  const hasSlots = slots.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-10 px-4">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <CalendarDays className="h-3.5 w-3.5" /> Phaos AI Onboarding
          </div>
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight">
            Let's make something happen.
          </h1>
          <p className="mt-2 text-muted-foreground">
            Grab a slot before the day fills up — time is a gift, let's use it well.
          </p>
        </div>

        <Card className="overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr_1fr]">
            <div className="border-b md:border-b-0 md:border-r p-6">
              <div className="text-xs font-medium uppercase text-muted-foreground">With</div>
              <div className="mt-1 text-lg font-semibold">{ctx.team_display_name}</div>
              <div className="mt-4 text-xs font-medium uppercase text-muted-foreground">Event</div>
              <div className="mt-1 text-sm font-semibold">{ctx.event_name}</div>
              <div className="mt-4 text-xs font-medium uppercase text-muted-foreground">Duration</div>
              <div className="mt-1 text-sm">{ctx.duration_minutes} min</div>
              <div className="mt-4 text-xs font-medium uppercase text-muted-foreground">Timezone (yours)</div>
              <div className="mt-1 text-sm">{BROWSER_TZ}</div>
            </div>

            {!showForm ? (
              <>
                <div className="border-b md:border-b-0 md:border-r p-4 max-h-[520px] overflow-y-auto">
                  <div className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Pick a date</div>
                  {!hasSlots ? (
                    <p className="text-sm text-muted-foreground">
                      The ultimate case of Phomo — this week is completely booked out. Please check back soon.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {dayKeys.map((k) => (
                        <button
                          key={k}
                          onClick={() => { setActiveDay(k); setSelectedSlot(null); }}
                          className={`block w-full rounded-md px-3 py-2 text-left text-sm transition ${
                            activeDay === k ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                          }`}
                        >
                          {formatSlotDay(k, ctx.team_timezone)}
                          <span className="ml-2 text-xs opacity-70">
                            {grouped.get(k)?.length ?? 0} slots
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-4 max-h-[520px] overflow-y-auto">
                  <div className="mb-3 text-xs font-semibold uppercase text-muted-foreground">
                    {activeDay ? formatSlotDay(activeDay, ctx.team_timezone) : "Available times"}
                  </div>
                  {activeDay ? (
                    <div className="grid grid-cols-2 gap-2">
                      {(grouped.get(activeDay) ?? []).map((s) => (
                        <button
                          key={s.toISOString()}
                          onClick={() => { setSelectedSlot(s); setShowForm(true); }}
                          className="rounded-md border px-3 py-2 text-sm font-medium hover:border-primary hover:text-primary transition"
                        >
                          {formatSlotTime(s, BROWSER_TZ)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Select a day to see available times.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="md:col-span-2 p-6">
                <div className="mb-4 text-sm">
                  <div className="text-xs uppercase text-muted-foreground">You're booking</div>
                  <div className="mt-1 text-lg font-semibold">
                    {selectedSlot ? formatFullSlot(selectedSlot, BROWSER_TZ) : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Host time: {selectedSlot ? formatInTimeZone(selectedSlot, ctx.team_timezone, "EEE, MMM d 'at' h:mm a") : ""} ({ctx.team_timezone})
                  </div>
                </div>
                <div className="grid gap-3">
                  <div>
                    <label className="text-xs font-medium">Your name</label>
                    <Input value={inviteeName} onChange={(e) => setInviteeName(e.target.value)} placeholder="Alex Rivera" />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Email</label>
                    <Input type="email" value={inviteeEmail} onChange={(e) => setInviteeEmail(e.target.value)} placeholder="you@company.com" />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Anything we should prep? <span className="text-muted-foreground">(optional)</span></label>
                    <Textarea rows={3} value={inviteeNotes} onChange={(e) => setInviteeNotes(e.target.value)} placeholder="Integrations to prioritize, use cases, questions…" />
                  </div>
                  {bookErr && <div className="rounded-md bg-destructive/10 text-destructive text-xs p-2">{bookErr}</div>}
                  <div className="flex items-center gap-2 pt-2">
                    <Button variant="ghost" onClick={() => setShowForm(false)}>Back</Button>
                    <Button onClick={submitBooking} disabled={!canBook || booking} className="flex-1">
                      {booking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm booking"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ShellCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-card border rounded-2xl shadow-xl p-8 text-center flex flex-col items-center">
        {children}
      </div>
    </div>
  );
}
