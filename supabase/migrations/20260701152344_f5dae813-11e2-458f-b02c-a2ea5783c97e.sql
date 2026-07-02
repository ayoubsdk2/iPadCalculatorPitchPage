
-- ============================================================
-- Phomo scheduling system
-- ============================================================

-- Extend app_role enum (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'phomo_team' AND enumtypid = 'public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'phomo_team';
  END IF;
END $$;

-- Enums
CREATE TYPE public.phomo_location_type AS ENUM ('zoom','google_meet','ms_teams','phone','in_person','ask_invitee','custom');
CREATE TYPE public.phomo_booking_status AS ENUM ('booked','canceled','rescheduled','completed');
CREATE TYPE public.phomo_booking_source AS ENUM ('post_stripe','direct_link');
CREATE TYPE public.phomo_workflow_trigger AS ENUM ('booking_created','reminder_24h','reminder_10m','canceled','completed');
CREATE TYPE public.phomo_workflow_channel AS ENUM ('email','sms');

-- ============================================================
-- team_profiles
-- ============================================================
CREATE TABLE public.team_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  phomo_slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_profiles TO authenticated;
GRANT ALL ON public.team_profiles TO service_role;
ALTER TABLE public.team_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own team profile"
  ON public.team_profiles FOR ALL
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER tg_team_profiles_updated BEFORE UPDATE ON public.team_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ============================================================
-- availability_rules
-- ============================================================
CREATE TABLE public.availability_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_profile_id UUID NOT NULL REFERENCES public.team_profiles(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_rules TO authenticated;
GRANT ALL ON public.availability_rules TO service_role;
ALTER TABLE public.availability_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own availability rules"
  ON public.availability_rules FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_profiles tp WHERE tp.id = team_profile_id AND (tp.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.team_profiles tp WHERE tp.id = team_profile_id AND (tp.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE TRIGGER tg_availability_rules_updated BEFORE UPDATE ON public.availability_rules
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE INDEX idx_availability_rules_profile ON public.availability_rules(team_profile_id, day_of_week);

-- ============================================================
-- availability_overrides
-- ============================================================
CREATE TABLE public.availability_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_profile_id UUID NOT NULL REFERENCES public.team_profiles(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  is_blocked BOOLEAN NOT NULL DEFAULT true,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (is_blocked OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_overrides TO authenticated;
GRANT ALL ON public.availability_overrides TO service_role;
ALTER TABLE public.availability_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own overrides"
  ON public.availability_overrides FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_profiles tp WHERE tp.id = team_profile_id AND (tp.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.team_profiles tp WHERE tp.id = team_profile_id AND (tp.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE TRIGGER tg_availability_overrides_updated BEFORE UPDATE ON public.availability_overrides
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE INDEX idx_availability_overrides_profile_date ON public.availability_overrides(team_profile_id, override_date);

-- ============================================================
-- event_types
-- ============================================================
CREATE TABLE public.event_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_profile_id UUID NOT NULL REFERENCES public.team_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
  description TEXT,
  location_type public.phomo_location_type NOT NULL DEFAULT 'ask_invitee',
  location_details TEXT,
  buffer_before_minutes INT NOT NULL DEFAULT 0,
  buffer_after_minutes INT NOT NULL DEFAULT 0,
  min_notice_minutes INT NOT NULL DEFAULT 60,
  max_days_ahead INT NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_public BOOLEAN NOT NULL DEFAULT true,
  is_onboarding BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_profile_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_types TO authenticated;
GRANT ALL ON public.event_types TO service_role;
ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own event types"
  ON public.event_types FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_profiles tp WHERE tp.id = team_profile_id AND (tp.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.team_profiles tp WHERE tp.id = team_profile_id AND (tp.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE TRIGGER tg_event_types_updated BEFORE UPDATE ON public.event_types
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ============================================================
-- bookings
-- ============================================================
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type_id UUID NOT NULL REFERENCES public.event_types(id) ON DELETE RESTRICT,
  team_profile_id UUID NOT NULL REFERENCES public.team_profiles(id) ON DELETE RESTRICT,
  invitee_name TEXT NOT NULL,
  invitee_email TEXT NOT NULL,
  invitee_notes TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  invitee_timezone TEXT NOT NULL DEFAULT 'America/New_York',
  status public.phomo_booking_status NOT NULL DEFAULT 'booked',
  source public.phomo_booking_source NOT NULL DEFAULT 'direct_link',
  pending_onboarding_id UUID REFERENCES public.pending_onboardings(id) ON DELETE SET NULL,
  manage_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  canceled_reason TEXT,
  rescheduled_from_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  qstash_message_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members see their own bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_profiles tp WHERE tp.id = team_profile_id AND (tp.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE POLICY "Team members update their own bookings"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_profiles tp WHERE tp.id = team_profile_id AND (tp.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE TRIGGER tg_bookings_updated BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE INDEX idx_bookings_profile_time ON public.bookings(team_profile_id, start_at) WHERE status IN ('booked','rescheduled');
CREATE INDEX idx_bookings_event_type ON public.bookings(event_type_id, start_at);
CREATE INDEX idx_bookings_pending_onboarding ON public.bookings(pending_onboarding_id);

-- ============================================================
-- workflows
-- ============================================================
CREATE TABLE public.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_profile_id UUID NOT NULL REFERENCES public.team_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger public.phomo_workflow_trigger NOT NULL,
  channel public.phomo_workflow_channel NOT NULL DEFAULT 'email',
  template_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflows TO authenticated;
GRANT ALL ON public.workflows TO service_role;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own workflows"
  ON public.workflows FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_profiles tp WHERE tp.id = team_profile_id AND (tp.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.team_profiles tp WHERE tp.id = team_profile_id AND (tp.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE TRIGGER tg_workflows_updated BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ============================================================
-- email_templates
-- ============================================================
CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_profile_id UUID REFERENCES public.team_profiles(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_profile_id, key)
);
CREATE UNIQUE INDEX ux_email_templates_default_key ON public.email_templates(key) WHERE team_profile_id IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read defaults and their own templates"
  ON public.email_templates FOR SELECT
  TO authenticated
  USING (team_profile_id IS NULL OR EXISTS (SELECT 1 FROM public.team_profiles tp WHERE tp.id = team_profile_id AND (tp.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE POLICY "Users manage their own templates"
  ON public.email_templates FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.team_profiles tp WHERE tp.id = team_profile_id AND (tp.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE POLICY "Users update their own templates"
  ON public.email_templates FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_profiles tp WHERE tp.id = team_profile_id AND (tp.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE POLICY "Users delete their own templates"
  ON public.email_templates FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_profiles tp WHERE tp.id = team_profile_id AND (tp.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE TRIGGER tg_email_templates_updated BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ============================================================
-- Public-safe views for anonymous booking pages
-- ============================================================
CREATE OR REPLACE VIEW public.public_event_types
WITH (security_invoker = true)
AS
SELECT
  et.id,
  et.team_profile_id,
  et.name,
  et.slug,
  et.duration_minutes,
  et.description,
  et.location_type,
  et.buffer_before_minutes,
  et.buffer_after_minutes,
  et.min_notice_minutes,
  et.max_days_ahead,
  et.is_onboarding,
  tp.display_name AS host_display_name,
  tp.avatar_url AS host_avatar_url,
  tp.bio AS host_bio,
  tp.timezone AS host_timezone,
  tp.phomo_slug AS host_slug
FROM public.event_types et
JOIN public.team_profiles tp ON tp.id = et.team_profile_id
WHERE et.is_active AND et.is_public AND tp.is_active;

-- Allow anon read on the view + underlying tables (view uses security_invoker)
GRANT SELECT ON public.public_event_types TO anon, authenticated;

-- Narrow anon SELECT policies on underlying tables so the view resolves
CREATE POLICY "Public read active team profiles"
  ON public.team_profiles FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "Public read active public event types"
  ON public.event_types FOR SELECT
  TO anon
  USING (is_active = true AND is_public = true);

CREATE POLICY "Public read availability rules"
  ON public.availability_rules FOR SELECT
  TO anon
  USING (EXISTS (SELECT 1 FROM public.team_profiles tp WHERE tp.id = team_profile_id AND tp.is_active = true));

CREATE POLICY "Public read availability overrides"
  ON public.availability_overrides FOR SELECT
  TO anon
  USING (EXISTS (SELECT 1 FROM public.team_profiles tp WHERE tp.id = team_profile_id AND tp.is_active = true));

-- Anon needs to see busy times to avoid double-booking, but only start/end
-- (no PII). We enforce column projection through a SECURITY DEFINER function.
CREATE OR REPLACE FUNCTION public.phomo_busy_times(
  _team_profile_id UUID,
  _from TIMESTAMPTZ,
  _to TIMESTAMPTZ
) RETURNS TABLE(start_at TIMESTAMPTZ, end_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.start_at, b.end_at
  FROM public.bookings b
  WHERE b.team_profile_id = _team_profile_id
    AND b.status IN ('booked','rescheduled')
    AND b.start_at < _to
    AND b.end_at > _from;
$$;
GRANT EXECUTE ON FUNCTION public.phomo_busy_times(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO anon, authenticated;

-- Public booking lookup by manage_token
CREATE OR REPLACE FUNCTION public.phomo_booking_by_token(_token UUID)
RETURNS TABLE(
  id UUID, event_type_id UUID, team_profile_id UUID,
  invitee_name TEXT, invitee_email TEXT, invitee_notes TEXT,
  start_at TIMESTAMPTZ, end_at TIMESTAMPTZ, invitee_timezone TEXT,
  status public.phomo_booking_status, event_name TEXT, duration_minutes INT,
  host_display_name TEXT
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id, b.event_type_id, b.team_profile_id,
         b.invitee_name, b.invitee_email, b.invitee_notes,
         b.start_at, b.end_at, b.invitee_timezone, b.status,
         et.name, et.duration_minutes, tp.display_name
  FROM public.bookings b
  JOIN public.event_types et ON et.id = b.event_type_id
  JOIN public.team_profiles tp ON tp.id = b.team_profile_id
  WHERE b.manage_token = _token;
$$;
GRANT EXECUTE ON FUNCTION public.phomo_booking_by_token(UUID) TO anon, authenticated;

-- ============================================================
-- Default email templates
-- ============================================================
INSERT INTO public.email_templates (team_profile_id, key, subject, body_html, body_text, is_default) VALUES
  (NULL, 'booking_created', 'Your Phaos AI onboarding is booked — {{event_name}}',
   '<p>Hi {{invitee_name}},</p><p>It''s official! Phomo cured. You''re locked in for <strong>{{event_name}}</strong> on <strong>{{start_at_human}}</strong>.</p><p>Looking forward to a great conversation.</p><p>— The Phaos AI Team</p>',
   'Hi {{invitee_name}},\n\nIt''s official! Phomo cured. You''re locked in for {{event_name}} on {{start_at_human}}.\n\nLooking forward to a great conversation.\n\n— The Phaos AI Team',
   true),
  (NULL, 'reminder_24h', 'See you tomorrow — {{event_name}}',
   '<p>Hi {{invitee_name}},</p><p>Just a friendly heads-up: our countdown is live. See you tomorrow at <strong>{{start_at_human}}</strong>.</p>',
   'Hi {{invitee_name}},\n\nJust a friendly heads-up: our countdown is live. See you tomorrow at {{start_at_human}}.',
   true),
  (NULL, 'reminder_10m', 'We''re live in 10 — {{event_name}}',
   '<p>Grab your coffee, stretch it out. We''re live in 10.</p>',
   'Grab your coffee, stretch it out. We''re live in 10.',
   true),
  (NULL, 'canceled', 'Your booking was canceled — {{event_name}}',
   '<p>Rain check? No worries at all. Life happens, and family/health always comes first. Let''s pick this up when the dust settles.</p><p><a href="{{reschedule_url}}">Pick a new time →</a></p>',
   'Rain check? No worries at all. Life happens, and family/health always comes first. Let''s pick this up when the dust settles.\n\nPick a new time: {{reschedule_url}}',
   true),
  (NULL, 'completed', 'Thanks for meeting with us — {{event_name}}',
   '<p>Thanks for the time today. If anything comes up, just reply to this email — we''re here.</p>',
   'Thanks for the time today. If anything comes up, just reply to this email — we''re here.',
   true);
