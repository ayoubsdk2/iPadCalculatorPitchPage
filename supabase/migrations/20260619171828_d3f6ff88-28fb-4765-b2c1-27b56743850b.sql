DROP POLICY IF EXISTS "Admins can view inquiries" ON public.solution_inquiries;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated, PUBLIC;
CREATE POLICY "Admins can view inquiries" ON public.solution_inquiries FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));