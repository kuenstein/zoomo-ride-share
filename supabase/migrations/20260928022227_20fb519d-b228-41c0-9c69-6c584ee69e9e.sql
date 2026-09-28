
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_driver_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_rating() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_ride_fare() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calculate_fare(public.vehicle_type, numeric, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_promo(text, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_ride(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_ride(uuid, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.wallet_topup(numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.nearby_drivers(double precision, double precision, double precision) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.expire_stale_rides() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_stats() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_fare(public.vehicle_type, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_promo(text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_ride(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_ride(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_topup(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nearby_drivers(double precision, double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_rides() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;
