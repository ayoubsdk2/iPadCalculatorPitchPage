// Client-side slot computation for the public Phomo scheduler.
// All time math is done in the host's IANA timezone using date-fns-tz,
// then converted back to UTC ISO for booking.
import { addDays, addMinutes, format, isBefore, startOfDay } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

export interface AvailabilityWindow {
  day_of_week: number; // 0=Sun..6=Sat
  start_time: string;  // "HH:mm:ss"
  end_time: string;
}

export interface AvailabilityOverride {
  override_date: string; // YYYY-MM-DD
  start_time: string | null;
  end_time: string | null;
  is_blocked: boolean;
  reason: string | null;
}

export interface BusyInterval {
  start_at: string; // ISO UTC
  end_at: string;
}

export interface SlotContext {
  timezone: string; // host tz
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minNoticeMinutes: number;
  slotStepMinutes?: number; // default 30
}

function parseHM(t: string): { h: number; m: number } {
  const [h, m] = t.split(":").map(Number);
  return { h: h || 0, m: m || 0 };
}

/** Build local (host-tz) Date at Y/M/D H:M then convert to a UTC Date. */
function tzDate(dateInHostTz: Date, h: number, m: number, tz: string): Date {
  const y = Number(formatInTimeZone(dateInHostTz, tz, "yyyy"));
  const mo = Number(formatInTimeZone(dateInHostTz, tz, "MM"));
  const d = Number(formatInTimeZone(dateInHostTz, tz, "dd"));
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(m)}:00`;
  return fromZonedTime(iso, tz);
}

/** Generate available slots (UTC Dates) across `days` days starting today. */
export function computeSlots({
  windows,
  overrides,
  busy,
  ctx,
  fromDate = new Date(),
  days = 21,
}: {
  windows: AvailabilityWindow[];
  overrides: AvailabilityOverride[];
  busy: BusyInterval[];
  ctx: SlotContext;
  fromDate?: Date;
  days?: number;
}): Date[] {
  const step = ctx.slotStepMinutes ?? 30;
  const now = new Date();
  const earliest = addMinutes(now, ctx.minNoticeMinutes);
  const results: Date[] = [];

  const busyRanges = busy.map((b) => ({
    s: new Date(b.start_at).getTime() - ctx.bufferAfterMinutes * 60_000,
    e: new Date(b.end_at).getTime() + ctx.bufferBeforeMinutes * 60_000,
  }));

  const overrideByDate = new Map<string, AvailabilityOverride>();
  for (const o of overrides) overrideByDate.set(o.override_date, o);

  for (let i = 0; i < days; i++) {
    const day = addDays(fromDate, i);
    const dateKey = formatInTimeZone(day, ctx.timezone, "yyyy-MM-dd");
    const dow = Number(formatInTimeZone(day, ctx.timezone, "i")) % 7; // 1..7 → 1..7, Sun=7 → map to 0
    const dowJs = dow === 7 ? 0 : dow;

    const ov = overrideByDate.get(dateKey);
    let intervals: Array<{ s: string; e: string }> = [];
    if (ov) {
      if (ov.is_blocked) continue;
      if (ov.start_time && ov.end_time) intervals = [{ s: ov.start_time, e: ov.end_time }];
    }
    if (intervals.length === 0) {
      intervals = windows
        .filter((w) => w.day_of_week === dowJs)
        .map((w) => ({ s: w.start_time, e: w.end_time }));
    }
    if (intervals.length === 0) continue;

    for (const iv of intervals) {
      const s = parseHM(iv.s);
      const e = parseHM(iv.e);
      let cur = tzDate(day, s.h, s.m, ctx.timezone);
      const windowEnd = tzDate(day, e.h, e.m, ctx.timezone);
      while (addMinutes(cur, ctx.durationMinutes) <= windowEnd) {
        const slotStart = cur.getTime();
        const slotEnd = slotStart + ctx.durationMinutes * 60_000;
        if (cur >= earliest) {
          const conflict = busyRanges.some((b) => b.s < slotEnd && b.e > slotStart);
          if (!conflict) results.push(new Date(slotStart));
        }
        cur = addMinutes(cur, step);
      }
    }
  }

  return results;
}

export function groupSlotsByDay(slots: Date[], tz: string): Map<string, Date[]> {
  const map = new Map<string, Date[]>();
  for (const s of slots) {
    const key = formatInTimeZone(s, tz, "yyyy-MM-dd");
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return map;
}

export function formatSlotTime(d: Date, tz: string): string {
  return formatInTimeZone(d, tz, "h:mm a");
}

export function formatSlotDay(dateKey: string, tz: string): string {
  // dateKey is yyyy-MM-dd already in tz
  const [y, m, d] = dateKey.split("-").map(Number);
  const iso = `${dateKey}T12:00:00`;
  const asUtc = fromZonedTime(iso, tz);
  return formatInTimeZone(asUtc, tz, "EEE, MMM d");
}

export function formatFullSlot(d: Date, tz: string): string {
  return formatInTimeZone(d, tz, "EEE, MMM d, yyyy 'at' h:mm a");
}
