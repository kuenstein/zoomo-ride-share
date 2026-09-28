CREATE OR REPLACE FUNCTION public.enforce_ride_fare()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE est NUMERIC; promo JSONB;
BEGIN
  IF NEW.vehicle_type::text NOT IN ('tricycle','bike') THEN
    RAISE EXCEPTION 'Only Tricycle and Motorcycle rides are available';
  END IF;
  IF NOT public.in_service_area(NEW.pickup_lat, NEW.pickup_lng) OR NOT public.in_service_area(NEW.dropoff_lat, NEW.dropoff_lng) THEN
    RAISE EXCEPTION 'Zoomo is not yet available in this area';
  END IF;
  est := public.ride_fare(NEW.vehicle_type, NEW.distance_km, NEW.duration_min,
    NEW.pickup_lat, NEW.pickup_lng, NEW.dropoff_lat, NEW.dropoff_lng);
  NEW.fare_estimate := est;
  NEW.discount := 0;
  IF NEW.promo_code IS NOT NULL AND length(trim(NEW.promo_code)) > 0 THEN
    promo := public.validate_promo(NEW.promo_code, est);
    IF (promo->>'valid')::boolean THEN
      NEW.discount := ROUND((promo->>'discount')::numeric, 0);
      NEW.promo_code := promo->>'code';
    ELSE NEW.promo_code := NULL; END IF;
  END IF;
  NEW.status := 'requested';
  NEW.driver_id := NULL;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.driver_vehicle_type(_user_id uuid)
RETURNS vehicle_type LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT v.type FROM public.vehicles v JOIN public.drivers d ON d.id = v.driver_id
      WHERE d.user_id = _user_id ORDER BY v.created_at DESC LIMIT 1 $$;

DROP POLICY IF EXISTS "driver reads assigned or open rides" ON public.rides;
CREATE POLICY "driver reads assigned or open rides" ON public.rides FOR SELECT TO authenticated
USING ((driver_id = auth.uid()) OR ((status = 'requested'::ride_status)
  AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid() AND d.status = 'approved'::driver_status)
  AND public.driver_vehicle_type(auth.uid()) = rides.vehicle_type));

CREATE OR REPLACE FUNCTION public.accept_ride(_ride_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE updated INT; vt vehicle_type;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.drivers WHERE user_id = auth.uid() AND status='approved') THEN
    RETURN jsonb_build_object('success', false, 'message','Driver not approved');
  END IF;
  vt := public.driver_vehicle_type(auth.uid());
  IF vt IS NULL OR vt::text NOT IN ('tricycle','bike') THEN
    RETURN jsonb_build_object('success', false, 'message','Update your vehicle type to Tricycle or Motorcycle first');
  END IF;
  UPDATE public.rides SET driver_id = auth.uid(), status='accepted', accepted_at = now()
  WHERE id = _ride_id AND status='requested' AND driver_id IS NULL AND vehicle_type = vt;
  GET DIAGNOSTICS updated = ROW_COUNT;
  IF updated = 0 THEN RETURN jsonb_build_object('success', false, 'message','Ride already taken'); END IF;
  INSERT INTO public.notifications (user_id, title, body)
  SELECT rider_id, 'Driver found!', 'Your driver is on the way.' FROM public.rides WHERE id = _ride_id;
  RETURN jsonb_build_object('success', true);
END; $function$;

CREATE OR REPLACE FUNCTION public.nearby_drivers(_lat double precision, _lng double precision, _radius_km double precision DEFAULT 5)
 RETURNS TABLE(driver_id uuid, lat double precision, lng double precision, distance_km double precision)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT dl.driver_id, dl.lat, dl.lng, public.haversine_km(_lat,_lng,dl.lat,dl.lng) AS distance_km
  FROM public.driver_locations dl
  JOIN public.drivers d ON d.user_id = dl.driver_id
  WHERE dl.is_online AND d.is_online AND d.status='approved'
    AND public.driver_vehicle_type(d.user_id)::text IN ('tricycle','bike')
    AND dl.updated_at > now() - interval '2 minutes'
    AND public.haversine_km(_lat,_lng,dl.lat,dl.lng) <= _radius_km
  ORDER BY distance_km ASC;
$function$;