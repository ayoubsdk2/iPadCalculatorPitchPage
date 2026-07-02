CREATE TABLE public.layout_settings (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

GRANT SELECT ON public.layout_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.layout_settings TO authenticated;
GRANT ALL ON public.layout_settings TO service_role;

ALTER TABLE public.layout_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read layout settings"
  ON public.layout_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert layout settings"
  ON public.layout_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update layout settings"
  ON public.layout_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

INSERT INTO public.layout_settings (id, settings) VALUES ('singleton', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;