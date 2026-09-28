REVOKE EXECUTE ON FUNCTION public.driver_vehicle_type(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_vehicle_type(uuid) TO authenticated;