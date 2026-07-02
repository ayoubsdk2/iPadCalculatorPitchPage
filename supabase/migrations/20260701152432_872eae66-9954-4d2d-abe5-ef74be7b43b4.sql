
REVOKE EXECUTE ON FUNCTION public.phomo_busy_times(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.phomo_booking_by_token(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.phomo_busy_times(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phomo_booking_by_token(UUID) TO anon, authenticated;
