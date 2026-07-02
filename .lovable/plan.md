
# Phomo by Phaos AI — Completion + Full QA Plan

The prior sessions scaffolded the database (`team_profiles`, `event_types`, `availability_rules`, `availability_overrides`, `bookings`, `workflows`, `email_templates`), the internal dashboard shells at `/phomo` and `/phomo/admin`, the Stripe checkout, and the `commitment/success` polling page. **The core Calendly-style flow is still missing:** there is no public booking page, no availability configuration UI, no event type editor, no workflow triggers, and the success page never actually navigates the buyer into a scheduler. This plan closes those gaps and gives you an end-to-end test path that doesn't require a real Stripe payment.

## What gets built

### 1. Test-mode bypass (so you can QA the whole thing today)
- Add a **"Skip Stripe (dev)"** button on the commitment dialog, gated by admin role, that creates a `pending_onboardings` row in `provisioning_complete` status and sends you straight to `/onboarding/schedule?onboarding=…`.
- Add an **"Impersonate booking"** button in `/phomo/admin` that opens `/onboarding/schedule` with a synthetic token so you can walk the client experience without any Stripe involvement.

### 2. Public booking scheduler `/onboarding/schedule` (external, warm hospitality tone)
- Reads the `pending_onboardings` row via `?onboarding=<id>` and looks up the assigned onboarding `event_type` (default: "Phaos AI Onboarding – 60 min").
- Server function `getAvailableSlots({ eventTypeId, from, to, timezone })` computes bookable slots from `availability_rules` minus `availability_overrides` minus existing `bookings` (uses existing `phomo_busy_times` function), honoring `min_notice_minutes`, `buffer_before/after`, and duration.
- UI: warm header ("Let's make something happen…"), timezone picker (auto-detected), 14-day date rail, time-of-day slot list, name/email/notes form, confirm CTA. Mobile-first.
- On confirm: `createBooking` server function inserts a `bookings` row (`created_via: 'post_stripe_onboarding'`), enqueues QStash reminders (24h + 10m) and a confirmation email via the existing `saved-calculator-share`-style pipeline (new templates `booking-confirmation`, `booking-reminder-24h`, `booking-reminder-10m`, `booking-canceled`, `booking-rescheduled`).
- Empty states: full week, Sundays blocked, past time, timezone mismatch — all with the exact copy you provided.
- Success screen with **Add to calendar** (.ics download), **Reschedule**, **Cancel** — the last two open `/onboarding/manage?token=<uuid>` powered by `phomo_booking_by_token`.

### 3. Commitment success page hand-off
- When `pending_onboardings.status = 'provisioning_complete'` and an onboarding booking hasn't been made yet, auto-redirect to `/onboarding/schedule?onboarding=<id>` instead of just showing text.
- If a booking already exists, redirect to `/onboarding/manage?token=…` instead.

### 4. Internal Availability tab (`/phomo/availability`)
- **List view** — weekly grid (Sun–Sat) with add/remove intervals, timezone, min-notice, buffers, "Block Sundays" toggle.
- **Calendar view** — month grid; click a date to add an override (blocked / custom hours / reason).
- Writes directly to `availability_rules` and `availability_overrides` under RLS.

### 5. Internal Scheduling tab / Event Type builder (`/phomo/scheduling`)
- Card list of event types with copy-link, toggle on/off, duplicate, delete, edit.
- Side-panel builder: name, slug, duration, description, location (Zoom / Meet / Teams / Phone / In-person / Ask invitee), public toggle, per-event buffers/min-notice.
- Live preview iframe of the public booking page for that event type.

### 6. Internal Meetings tab (`/phomo/meetings`)
- Upcoming / past / canceled tabs, filter by team member, click into a booking to reschedule/cancel on behalf of an invitee.

### 7. Internal Workflows tab (`/phomo/workflows`) + QStash wiring
- Grid of workflow template cards (24h reminder, 10m heads-up, thank-you, cancellation) with add / toggle / edit copy.
- Server function `scheduleBookingWorkflows(bookingId)` enqueues jobs to QStash (`QSTASH_TOKEN` already set) with `x-phaos-provisioning-token` HMAC.
- New public route `POST /api/public/workflows/execute` — verifies the token, sends the templated email via the existing `/lovable/email/transactional/send` pipeline, logs to a new `workflow_runs` table for observability (stand-in for Langfuse until you decide to wire that).

### 8. Onboarding wizard for new Phomo team members
- Detects an empty `team_profiles` row on `/phomo` first-load and walks Connect Calendar → Working Hours → First Event Type, using the exact witty copy you provided.
- Calendar connection: Google/Outlook OAuth stubs (buttons + status pill; actual OAuth is out of scope unless you say so — say the word and I'll wire Google Calendar in a follow-up).

### 9. Error / edge states
- Global `notFoundComponent` on `__root` with your "Lost in the wilderness" copy.
- Consistent empty/blocked/past/timezone/calendar-sync-fail states matching your tone matrix.

## Data model additions
Small additive migration only — no drops:
- `workflow_runs` (id, booking_id, workflow_id, template_key, status, error, executed_at) with RLS + service_role grants.
- `pending_onboardings.booking_id` nullable FK to `bookings` so the success page can detect "already booked".

## 100-point QA Pass (run after build)
I'll drive Playwright against the running preview and produce a pass/fail matrix across these areas — screenshots for each failing check:

1. **Payment → Scheduler handoff (10)** — real Stripe test card, skip-Stripe bypass, missing onboarding param, expired session, failed payment, canceled payment, provisioning still running, provisioning complete without event type, already-booked repeat visit, deep-link with stale token.
2. **Availability math (15)** — DST spring/fall boundary, timezone across day boundary, min-notice edge, buffer overlap, back-to-back booking prevention, override blocks slot, override extends slot, weekly rule crosses midnight, Sunday block, holiday block, past-time rejection, 2-week horizon cap, empty week, fully-booked week, single-slot-left race.
3. **Booking form (10)** — invalid email, invalid name, 500-char notes, XSS attempt in name, duplicate submission (double-click), slow network, offline, missing timezone, cross-tab double-book race, mobile viewport.
4. **Confirmation / manage (10)** — ICS download opens in Calendar, reschedule flow, cancel flow, manage-link with bad token, manage-link with canceled booking, manage-link after event, email suppression check, `+addressing` email, unicode name, RTL name.
5. **Internal Availability (10)** — add interval, remove, copy day, timezone change, override create, override delete, month navigation, block Sundays toggle, buffer edit, min-notice edit.
6. **Internal Scheduling / Event builder (10)** — create, duplicate, delete, toggle off (public page 404s), copy link, edit duration, edit location, live preview refresh, slug collision, empty name validation.
7. **Meetings tab (5)** — filter by member, upcoming/past split, cancel on behalf, reschedule on behalf, empty state.
8. **Workflows / QStash (10)** — enqueue on booking, execute on schedule, HMAC rejection, retry on 5xx, duplicate suppression via idempotency key, template render with missing var, unsubscribed recipient blocked, cancellation triggers cancel email, reschedule triggers reschedule email, workflow toggle off skips send.
9. **Auth / RLS (10)** — team member sees only own data, admin sees all, unauthenticated redirected from `/phomo`, `/phomo/admin` requires `admin` role, public `/onboarding/schedule` needs no auth, direct DB writes as anon are blocked, service-role writes succeed, hostile subdomain rejected, expired JWT refresh, sign-out clears cache.
10. **Accessibility / mobile / performance (10)** — keyboard nav on date picker, focus rings, aria labels, contrast on accent color, iPad portrait, iPad landscape, iPhone SE, screen-reader confirmation announcement, first-paint under 2s, no console errors.

Results: `/mnt/documents/phomo-qa-report.md` with pass/fail per check and Playwright screenshots for every failure.

## Explicit non-goals (call out if you want them in scope)
- Real Google/Outlook OAuth calendar sync (buttons + status only for now).
- Langfuse SDK wiring (using `workflow_runs` table for observability instead).
- SMS delivery via a provider (workflow supports channel:sms but only stubs).
- Firecrawl enrichment (no obvious hook in current scope).

## Sequencing (build order in the same turn once approved)
1. Migration (`workflow_runs`, `pending_onboardings.booking_id`).
2. Server functions: `getAvailableSlots`, `createBooking`, `rescheduleBooking`, `cancelBooking`, `scheduleBookingWorkflows`.
3. Email templates + registry entries for booking lifecycle.
4. Public routes: `/onboarding/schedule`, `/onboarding/manage`, `/api/public/workflows/execute`, `__root` 404.
5. Success page redirect logic.
6. Internal tabs: Availability, Scheduling/Event builder, Meetings, Workflows, first-run wizard.
7. Skip-Stripe dev button + Impersonate booking.
8. Playwright QA suite → report.

## Two questions before I start
1. **Calendar OAuth** — buttons + status pill only for now, and wire real Google Calendar sync as a follow-up? Or block the launch on real OAuth?
2. **Onboarding event type default** — should I auto-create a "Phaos AI Onboarding – 60 min" event type owned by `daniel@phaosai.com` on first migration so the post-Stripe scheduler has something to book against out of the box?
