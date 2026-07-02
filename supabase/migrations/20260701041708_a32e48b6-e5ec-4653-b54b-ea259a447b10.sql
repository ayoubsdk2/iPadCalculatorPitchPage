
DROP POLICY IF EXISTS "Admins can read all admin cells" ON public.admin_cells;
DROP POLICY IF EXISTS "Admins can insert admin cells" ON public.admin_cells;
DROP POLICY IF EXISTS "Admins can update admin cells" ON public.admin_cells;
DROP POLICY IF EXISTS "Admins can delete admin cells" ON public.admin_cells;

CREATE POLICY "Admins can read all admin cells" ON public.admin_cells
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can insert admin cells" ON public.admin_cells
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update admin cells" ON public.admin_cells
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete admin cells" ON public.admin_cells
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, authenticated, anon;
