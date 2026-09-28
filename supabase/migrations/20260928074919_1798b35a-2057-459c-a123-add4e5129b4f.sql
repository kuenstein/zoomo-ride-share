CREATE OR REPLACE FUNCTION public.shares_ride(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _a IS NOT NULL AND _b IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.rides
    WHERE (rider_id = _a AND driver_id = _b) OR (rider_id = _b AND driver_id = _a));
$$;

CREATE OR REPLACE FUNCTION public.has_active_ride_with(_rider uuid, _driver uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.rides WHERE rider_id = _rider AND driver_id = _driver
    AND status IN ('accepted','arriving','in_progress'));
$$;

DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;
CREATE POLICY "profiles readable by self, ride partners, admin" ON public.profiles
FOR SELECT TO authenticated USING (
  id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.shares_ride(auth.uid(), id));

DROP POLICY IF EXISTS "drivers readable" ON public.drivers;
CREATE POLICY "drivers readable by self, riders, admin" ON public.drivers
FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.shares_ride(auth.uid(), user_id));

DROP POLICY IF EXISTS "vehicles readable" ON public.vehicles;
CREATE POLICY "vehicles readable by owner, riders, admin" ON public.vehicles
FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR EXISTS (
    SELECT 1 FROM public.drivers d WHERE d.id = vehicles.driver_id
      AND (d.user_id = auth.uid() OR public.shares_ride(auth.uid(), d.user_id))));

DROP POLICY IF EXISTS "locations readable by authenticated" ON public.driver_locations;
CREATE POLICY "locations readable by self, active rider, admin" ON public.driver_locations
FOR SELECT TO authenticated USING (
  driver_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_active_ride_with(auth.uid(), driver_id));