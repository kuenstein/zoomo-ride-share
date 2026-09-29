CREATE OR REPLACE FUNCTION public.seed_driver_location()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.driver_locations (driver_id, lat, lng, is_online, updated_at)
  VALUES (NEW.user_id, 9.3068, 123.3054, false, now())
  ON CONFLICT (driver_id) DO NOTHING;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.seed_driver_location() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS seed_driver_location ON public.drivers;
CREATE TRIGGER seed_driver_location AFTER INSERT ON public.drivers
FOR EACH ROW EXECUTE FUNCTION public.seed_driver_location();

INSERT INTO public.driver_locations (driver_id, lat, lng, is_online, updated_at)
SELECT d.user_id, 9.3068, 123.3054, false, now() FROM public.drivers d
ON CONFLICT (driver_id) DO NOTHING;