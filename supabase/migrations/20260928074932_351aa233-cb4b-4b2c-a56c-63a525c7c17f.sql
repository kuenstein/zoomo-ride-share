REVOKE EXECUTE ON FUNCTION public.shares_ride(uuid,uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_active_ride_with(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shares_ride(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_ride_with(uuid,uuid) TO authenticated;