CREATE POLICY "Admins can view inquiries" ON public.solution_inquiries FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;