
DROP POLICY IF EXISTS "Admins can insert layout settings" ON public.layout_settings;
DROP POLICY IF EXISTS "Admins can update layout settings" ON public.layout_settings;

CREATE POLICY "Admins can insert layout settings"
  ON public.layout_settings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update layout settings"
  ON public.layout_settings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
