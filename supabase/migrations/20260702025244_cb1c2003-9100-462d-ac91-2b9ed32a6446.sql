
CREATE TABLE public.workflow_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE SET NULL,
  template_key TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  status TEXT NOT NULL DEFAULT 'queued',
  scheduled_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT workflow_runs_status_check CHECK (status IN ('queued','sent','failed','skipped'))
);
CREATE INDEX idx_workflow_runs_booking ON public.workflow_runs(booking_id);
GRANT SELECT ON public.workflow_runs TO authenticated;
GRANT ALL ON public.workflow_runs TO service_role;
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can view own workflow runs" ON public.workflow_runs
FOR SELECT TO authenticated
USING (
  booking_id IN (
    SELECT b.id FROM public.bookings b
    JOIN public.team_profiles tp ON tp.id = b.team_profile_id
    WHERE tp.user_id = auth.uid()
  )
);
CREATE POLICY "Admins view all workflow runs" ON public.workflow_runs
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.phomo_get_event_context(_event_type_id UUID)
RETURNS TABLE (
  event_type_id UUID, event_name TEXT, duration_minutes INTEGER,
  buffer_before_minutes INTEGER, buffer_after_minutes INTEGER,
  min_notice_minutes INTEGER, max_days_ahead INTEGER,
  location_type phomo_location_type,
  team_profile_id UUID, team_display_name TEXT, team_timezone TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT et.id, et.name, et.duration_minutes,
         et.buffer_before_minutes, et.buffer_after_minutes,
         et.min_notice_minutes, et.max_days_ahead,
         et.location_type,
         tp.id, tp.display_name, tp.timezone
  FROM public.event_types et
  JOIN public.team_profiles tp ON tp.id = et.team_profile_id
  WHERE et.id = _event_type_id AND et.is_active = true
    AND et.is_public = true AND tp.is_active = true
$$;

CREATE OR REPLACE FUNCTION public.phomo_get_availability_windows(_team_profile_id UUID)
RETURNS TABLE (day_of_week SMALLINT, start_time TIME, end_time TIME)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ar.day_of_week, ar.start_time, ar.end_time
  FROM public.availability_rules ar
  WHERE ar.team_profile_id = _team_profile_id
  ORDER BY ar.day_of_week, ar.start_time
$$;

CREATE OR REPLACE FUNCTION public.phomo_get_overrides(_team_profile_id UUID, _from DATE, _to DATE)
RETURNS TABLE (override_date DATE, start_time TIME, end_time TIME, is_blocked BOOLEAN, reason TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ao.override_date, ao.start_time, ao.end_time, ao.is_blocked, ao.reason
  FROM public.availability_overrides ao
  WHERE ao.team_profile_id = _team_profile_id AND ao.override_date BETWEEN _from AND _to
$$;

GRANT EXECUTE ON FUNCTION public.phomo_get_event_context(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phomo_get_availability_windows(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phomo_get_overrides(UUID, DATE, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phomo_busy_times(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.phomo_create_booking(
  _event_type_id UUID, _invitee_name TEXT, _invitee_email TEXT, _invitee_notes TEXT,
  _start_at TIMESTAMPTZ, _invitee_timezone TEXT, _pending_onboarding_id UUID DEFAULT NULL
) RETURNS TABLE (id UUID, manage_token UUID, end_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _et RECORD; _end_at TIMESTAMPTZ; _booking_id UUID; _token UUID;
BEGIN
  IF _invitee_name IS NULL OR length(trim(_invitee_name)) < 1 THEN RAISE EXCEPTION 'invitee_name required'; END IF;
  IF _invitee_email IS NULL OR _invitee_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'valid invitee_email required'; END IF;
  SELECT et.duration_minutes, et.min_notice_minutes, et.buffer_before_minutes, et.buffer_after_minutes,
         et.is_active, et.is_public, et.team_profile_id, et.max_days_ahead INTO _et
  FROM public.event_types et WHERE et.id = _event_type_id;
  IF NOT FOUND OR NOT _et.is_active OR NOT _et.is_public THEN RAISE EXCEPTION 'event type not bookable'; END IF;
  _end_at := _start_at + (_et.duration_minutes || ' minutes')::INTERVAL;
  IF _start_at < now() + (_et.min_notice_minutes || ' minutes')::INTERVAL THEN RAISE EXCEPTION 'slot violates minimum notice'; END IF;
  IF _start_at > now() + (_et.max_days_ahead || ' days')::INTERVAL THEN RAISE EXCEPTION 'slot beyond booking horizon'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.bookings b WHERE b.team_profile_id = _et.team_profile_id
      AND b.status IN ('booked','rescheduled')
      AND b.start_at - (_et.buffer_after_minutes || ' minutes')::INTERVAL < _end_at
      AND b.end_at + (_et.buffer_before_minutes || ' minutes')::INTERVAL > _start_at
  ) THEN RAISE EXCEPTION 'slot no longer available'; END IF;
  _token := gen_random_uuid();
  INSERT INTO public.bookings (
    event_type_id, team_profile_id, invitee_name, invitee_email, invitee_notes,
    start_at, end_at, invitee_timezone, status, source, pending_onboarding_id, manage_token
  ) VALUES (
    _event_type_id, _et.team_profile_id, trim(_invitee_name), lower(trim(_invitee_email)), _invitee_notes,
    _start_at, _end_at, coalesce(_invitee_timezone, 'America/New_York'), 'booked',
    CASE WHEN _pending_onboarding_id IS NOT NULL THEN 'post_stripe_onboarding'::phomo_booking_source
         ELSE 'direct_link'::phomo_booking_source END,
    _pending_onboarding_id, _token
  ) RETURNING bookings.id INTO _booking_id;
  RETURN QUERY SELECT _booking_id, _token, _end_at;
END; $$;

CREATE OR REPLACE FUNCTION public.phomo_cancel_booking(_token UUID, _reason TEXT DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.bookings SET status = 'canceled', canceled_reason = _reason, updated_at = now()
  WHERE manage_token = _token AND status IN ('booked','rescheduled');
  RETURN FOUND;
END; $$;

CREATE OR REPLACE FUNCTION public.phomo_reschedule_booking(
  _token UUID, _new_start_at TIMESTAMPTZ, _new_timezone TEXT
) RETURNS TABLE (id UUID, manage_token UUID, end_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _old RECORD; _et RECORD; _end_at TIMESTAMPTZ; _new_id UUID; _new_token UUID;
BEGIN
  SELECT b.id, b.event_type_id, b.team_profile_id, b.invitee_name, b.invitee_email,
         b.invitee_notes, b.pending_onboarding_id INTO _old
  FROM public.bookings b WHERE b.manage_token = _token AND b.status IN ('booked','rescheduled');
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found'; END IF;
  SELECT et.duration_minutes, et.min_notice_minutes, et.buffer_before_minutes, et.buffer_after_minutes INTO _et
    FROM public.event_types et WHERE et.id = _old.event_type_id;
  _end_at := _new_start_at + (_et.duration_minutes || ' minutes')::INTERVAL;
  IF _new_start_at < now() + (_et.min_notice_minutes || ' minutes')::INTERVAL THEN RAISE EXCEPTION 'slot violates minimum notice'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.bookings b2 WHERE b2.team_profile_id = _old.team_profile_id
      AND b2.id <> _old.id AND b2.status IN ('booked','rescheduled')
      AND b2.start_at - (_et.buffer_after_minutes || ' minutes')::INTERVAL < _end_at
      AND b2.end_at + (_et.buffer_before_minutes || ' minutes')::INTERVAL > _new_start_at
  ) THEN RAISE EXCEPTION 'slot no longer available'; END IF;
  UPDATE public.bookings SET status = 'rescheduled', updated_at = now() WHERE id = _old.id;
  _new_token := gen_random_uuid();
  INSERT INTO public.bookings (
    event_type_id, team_profile_id, invitee_name, invitee_email, invitee_notes,
    start_at, end_at, invitee_timezone, status, source, pending_onboarding_id,
    rescheduled_from_id, manage_token
  ) VALUES (
    _old.event_type_id, _old.team_profile_id, _old.invitee_name, _old.invitee_email, _old.invitee_notes,
    _new_start_at, _end_at, coalesce(_new_timezone, 'America/New_York'), 'booked', 'direct_link',
    _old.pending_onboarding_id, _old.id, _new_token
  ) RETURNING bookings.id INTO _new_id;
  RETURN QUERY SELECT _new_id, _new_token, _end_at;
END; $$;

GRANT EXECUTE ON FUNCTION public.phomo_create_booking(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phomo_cancel_booking(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phomo_reschedule_booking(UUID, TIMESTAMPTZ, TEXT) TO anon, authenticated;

DO $$
DECLARE _user_id UUID; _profile_id UUID;
BEGIN
  SELECT id INTO _user_id FROM auth.users WHERE lower(email) = 'daniel@phaosai.com' LIMIT 1;
  IF _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.team_profiles (user_id, display_name, phomo_slug, bio, timezone)
  VALUES (_user_id, 'Daniel — Phaos AI Onboarding', 'daniel',
          'Founder & onboarding lead at Phaos AI. Let''s get your voice agent live.',
          'America/New_York')
  ON CONFLICT (user_id) DO UPDATE SET is_active = true
  RETURNING id INTO _profile_id;
  IF _profile_id IS NULL THEN
    SELECT id INTO _profile_id FROM public.team_profiles WHERE user_id = _user_id;
  END IF;
  INSERT INTO public.availability_rules (team_profile_id, day_of_week, start_time, end_time)
  SELECT _profile_id, d::SMALLINT, '09:00', '17:00'
  FROM generate_series(1,5) d
  ON CONFLICT DO NOTHING;
  INSERT INTO public.event_types (
    team_profile_id, name, slug, duration_minutes, description, location_type,
    buffer_before_minutes, buffer_after_minutes, min_notice_minutes, max_days_ahead,
    is_active, is_public, is_onboarding
  ) VALUES (
    _profile_id, 'Phaos AI Onboarding – 60 min', 'phaos-onboarding-60', 60,
    'Kickoff call to configure your Phaos AI voice agent, integrations, and go-live plan.',
    'google_meet', 15, 15, 60, 30, true, true, true
  ) ON CONFLICT (team_profile_id, slug) DO NOTHING;
  INSERT INTO public.workflows (team_profile_id, name, trigger, channel, is_enabled, template_key)
  VALUES
    (_profile_id, '24-hour reminder', 'reminder_24h', 'email', true, 'booking-reminder-24h'),
    (_profile_id, '10-minute heads up', 'reminder_10m', 'email', true, 'booking-reminder-10m'),
    (_profile_id, 'Booking confirmation', 'booking_created', 'email', true, 'booking-confirmation'),
    (_profile_id, 'Cancellation notice', 'canceled', 'email', true, 'booking-canceled')
  ON CONFLICT DO NOTHING;
END $$;
