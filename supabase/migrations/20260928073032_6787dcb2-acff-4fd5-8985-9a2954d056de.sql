REVOKE EXECUTE ON FUNCTION public.protect_ride_money() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_tip(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_tip(uuid, numeric) TO authenticated;