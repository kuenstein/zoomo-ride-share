-- ===== Rides: direct (choose-your-driver) requests + cancellation source =====
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS target_driver_id uuid,
  ADD COLUMN IF NOT EXISTS target_status text,
  ADD COLUMN IF NOT EXISTS target_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by text;
ALTER TABLE public.rides DROP CONSTRAINT IF EXISTS rides_target_status_chk;
ALTER TABLE public.rides ADD CONSTRAINT rides_target_status_chk CHECK (target_status IS NULL OR target_status IN ('pending','declined'));
ALTER TABLE public.rides DROP CONSTRAINT IF EXISTS rides_cancelled_by_chk;
ALTER TABLE public.rides ADD CONSTRAINT rides_cancelled_by_chk CHECK (cancelled_by IS NULL OR cancelled_by IN ('rider','driver','admin','system'));
CREATE INDEX IF NOT EXISTS rides_target_driver_idx ON public.rides(target_driver_id) WHERE status = 'requested';

-- Eligible driver for a direct request
CREATE OR REPLACE FUNCTION public.driver_available_for(_driver uuid, _type vehicle_type)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.drivers d JOIN public.driver_locations dl ON dl.driver_id = d.user_id
    WHERE d.user_id = _driver AND d.status = 'approved' AND d.is_online AND dl.is_online
      AND dl.updated_at > now() - interval '2 minutes'
      AND public.driver_vehicle_type(d.user_id) = _type
      AND NOT public.driver_debt_blocked(d.user_id)
      AND NOT public.driver_license_expired(d.user_id)
      AND NOT EXISTS (SELECT 1 FROM public.rides r WHERE r.driver_id = d.user_id AND r.status IN ('accepted','arriving','in_progress'))
  );
$$;
REVOKE EXECUTE ON FUNCTION public.driver_available_for(uuid, vehicle_type) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.driver_available_for(uuid, vehicle_type) TO authenticated;

-- Insert-time validation of targeting (server sets status/expiry; client can't pick them)
CREATE OR REPLACE FUNCTION public.validate_ride_target()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.cancelled_by := NULL;
  IF NEW.target_driver_id IS NULL THEN
    NEW.target_status := NULL; NEW.target_expires_at := NULL;
    RETURN NEW;
  END IF;
  IF NEW.target_driver_id = NEW.rider_id OR NOT public.driver_available_for(NEW.target_driver_id, NEW.vehicle_type) THEN
    RAISE EXCEPTION 'That driver is no longer available. Please choose another driver.';
  END IF;
  NEW.target_status := 'pending';
  NEW.target_expires_at := now() + interval '45 seconds';
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS validate_ride_target ON public.rides;
CREATE TRIGGER validate_ride_target BEFORE INSERT ON public.rides FOR EACH ROW EXECUTE FUNCTION public.validate_ride_target();

-- Driver within 1 km of pickup => rider can't cancel
CREATE OR REPLACE FUNCTION public.rider_cancel_blocked(_ride_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rides r JOIN public.driver_locations dl ON dl.driver_id = r.driver_id
    WHERE r.id = _ride_id AND r.status IN ('accepted','arriving')
      AND public.haversine_km(r.pickup_lat, r.pickup_lng, dl.lat, dl.lng) <= 1
  );
$$;
REVOKE EXECUTE ON FUNCTION public.rider_cancel_blocked(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.rider_cancel_blocked(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.rider_cancel_ride(_ride_id uuid, _reason text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int; r public.rides;
BEGIN
  SELECT * INTO r FROM public.rides WHERE id=_ride_id AND rider_id=auth.uid() FOR UPDATE;
  IF NOT FOUND OR r.status NOT IN ('requested','accepted','arriving') THEN
    RETURN jsonb_build_object('success',false,'message','This ride can no longer be cancelled');
  END IF;
  IF public.rider_cancel_blocked(_ride_id) THEN
    RETURN jsonb_build_object('success',false,'code','driver_near','message','Your driver is almost there — cancelling now isn''t available.');
  END IF;
  UPDATE public.rides SET status='cancelled', cancelled_at=now(), cancelled_by='rider',
    cancel_reason=left(COALESCE(NULLIF(trim(_reason),''),'Cancelled by rider'),300)
  WHERE id=_ride_id;
  INSERT INTO public.notifications (user_id,title,body)
    SELECT driver_id,'Trip cancelled','The rider cancelled this trip.' FROM public.rides WHERE id=_ride_id AND driver_id IS NOT NULL;
  RETURN jsonb_build_object('success',true);
END; $$;

CREATE OR REPLACE FUNCTION public.driver_set_ride_status(_ride_id uuid, _status ride_status, _reason text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rides; why text;
BEGIN
  SELECT * INTO r FROM public.rides WHERE id=_ride_id FOR UPDATE;
  IF NOT FOUND OR r.driver_id IS DISTINCT FROM auth.uid() THEN RETURN jsonb_build_object('success',false,'message','Not your ride'); END IF;
  IF r.status='accepted' AND _status='arriving' THEN
    UPDATE public.rides SET status='arriving' WHERE id=_ride_id;
  ELSIF r.status='arriving' AND _status='in_progress' THEN
    UPDATE public.rides SET status='in_progress', started_at=now() WHERE id=_ride_id;
  ELSIF r.status IN ('accepted','arriving') AND _status='cancelled' THEN
    why := NULLIF(trim(COALESCE(_reason,'')),'');
    UPDATE public.rides SET status='cancelled', cancelled_at=now(), cancelled_by='driver',
      cancel_reason=left(COALESCE(why,'Cancelled by driver'),300) WHERE id=_ride_id;
    INSERT INTO public.notifications (user_id,title,body,url) VALUES (r.rider_id,'Your driver cancelled',
      CASE WHEN why IS NULL THEN 'Your driver cancelled the trip. Tap to find another ride.'
           ELSE 'Your driver cancelled: ' || left(why,120) || '. Tap to find another ride.' END, '/ride');
  ELSE
    RETURN jsonb_build_object('success',false,'message','Trip status can''t change from '||r.status||' to '||_status);
  END IF;
  RETURN jsonb_build_object('success',true);
END; $$;

-- Direct-request actions
CREATE OR REPLACE FUNCTION public.decline_direct_ride(_ride_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  UPDATE public.rides SET target_status='declined'
  WHERE id=_ride_id AND target_driver_id=auth.uid() AND status='requested' AND target_status='pending';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n=0 THEN RETURN jsonb_build_object('success',false,'message','This request is no longer pending'); END IF;
  INSERT INTO public.notifications (user_id,title,body,url)
    SELECT rider_id,'Driver unavailable','The driver you chose can''t take this trip. Pick another driver or send it to any driver.','/ride'
    FROM public.rides WHERE id=_ride_id;
  RETURN jsonb_build_object('success',true);
END; $$;

CREATE OR REPLACE FUNCTION public.ride_retarget(_ride_id uuid, _driver_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rides;
BEGIN
  SELECT * INTO r FROM public.rides WHERE id=_ride_id AND rider_id=auth.uid() AND status='requested' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'message','This request is no longer open'); END IF;
  IF _driver_id = auth.uid() OR NOT public.driver_available_for(_driver_id, r.vehicle_type) THEN
    RETURN jsonb_build_object('success',false,'message','That driver is no longer available');
  END IF;
  UPDATE public.rides SET target_driver_id=_driver_id, target_status='pending',
    target_expires_at=now()+interval '45 seconds', requested_at=now() WHERE id=_ride_id;
  INSERT INTO public.notifications (user_id,title,body,url)
    VALUES (_driver_id,'A rider chose you','Direct ride request from ' || left(r.pickup_address,80),'/driver');
  RETURN jsonb_build_object('success',true);
END; $$;

CREATE OR REPLACE FUNCTION public.ride_broadcast(_ride_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rides;
BEGIN
  SELECT * INTO r FROM public.rides WHERE id=_ride_id AND rider_id=auth.uid() AND status='requested' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'message','This request is no longer open'); END IF;
  UPDATE public.rides SET target_driver_id=NULL, target_status=NULL, target_expires_at=NULL, requested_at=now() WHERE id=_ride_id;
  INSERT INTO public.notifications (user_id, title, body, url)
  SELECT nd.driver_id, 'New ride request',
    CASE WHEN r.vehicle_type::text = 'tricycle' THEN 'Tricycle' ELSE 'Motorcycle' END || ' trip from ' || left(r.pickup_address, 80), '/driver'
  FROM public.nearby_drivers(r.pickup_lat, r.pickup_lng, 5) nd
  WHERE public.driver_vehicle_type(nd.driver_id) = r.vehicle_type AND nd.driver_id <> r.rider_id;
  RETURN jsonb_build_object('success',true);
END; $$;

REVOKE EXECUTE ON FUNCTION public.decline_direct_ride(uuid), public.ride_retarget(uuid,uuid), public.ride_broadcast(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.decline_direct_ride(uuid), public.ride_retarget(uuid,uuid), public.ride_broadcast(uuid) TO authenticated;

-- accept_ride honours targeting
CREATE OR REPLACE FUNCTION public.accept_ride(_ride_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE updated INT; vt vehicle_type;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success', false, 'message','Not signed in'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('accept_ride:' || auth.uid()::text));
  IF NOT EXISTS (SELECT 1 FROM public.drivers WHERE user_id = auth.uid() AND status='approved') THEN
    RETURN jsonb_build_object('success', false, 'message','Driver not approved');
  END IF;
  IF EXISTS (SELECT 1 FROM public.rides WHERE driver_id = auth.uid() AND status IN ('accepted','arriving','in_progress')) THEN
    RETURN jsonb_build_object('success', false, 'code','active_ride', 'message','Finish your current trip before accepting another ride');
  END IF;
  IF public.driver_license_expired(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'message','Your driver''s license has expired');
  END IF;
  IF public.driver_debt_blocked(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'message','Please settle what you owe Zoomo before accepting rides');
  END IF;
  vt := public.driver_vehicle_type(auth.uid());
  IF vt IS NULL OR vt::text NOT IN ('tricycle','bike') THEN
    RETURN jsonb_build_object('success', false, 'message','Update your vehicle type to Tricycle or Motorcycle first');
  END IF;
  UPDATE public.rides SET driver_id = auth.uid(), status='accepted', accepted_at = now(), target_status = NULL
  WHERE id = _ride_id AND status='requested' AND driver_id IS NULL AND vehicle_type = vt
    AND requested_at > now() - interval '2 minutes'
    AND (target_driver_id IS NULL
         OR (target_driver_id = auth.uid() AND target_status = 'pending' AND target_expires_at > now()));
  GET DIAGNOSTICS updated = ROW_COUNT;
  IF updated = 0 THEN RETURN jsonb_build_object('success', false, 'code','taken', 'message','Ride already taken or expired'); END IF;
  INSERT INTO public.notifications (user_id, title, body)
  SELECT rider_id, 'Driver found!', 'Your driver is on the way.' FROM public.rides WHERE id = _ride_id;
  RETURN jsonb_build_object('success', true);
END; $$;

-- New-request notifications: direct requests ping only the chosen driver
CREATE OR REPLACE FUNCTION public.notify_ride_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.target_driver_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, url)
      VALUES (NEW.target_driver_id, 'A rider chose you', 'Direct ride request from ' || left(NEW.pickup_address, 80), '/driver');
    ELSE
      INSERT INTO public.notifications (user_id, title, body, url)
      SELECT nd.driver_id, 'New ride request',
        CASE WHEN NEW.vehicle_type::text = 'tricycle' THEN 'Tricycle' ELSE 'Motorcycle' END || ' trip from ' || left(NEW.pickup_address, 80),
        '/driver'
      FROM public.nearby_drivers(NEW.pickup_lat, NEW.pickup_lng, 5) nd
      WHERE public.driver_vehicle_type(nd.driver_id) = NEW.vehicle_type AND nd.driver_id <> NEW.rider_id;
    END IF;
  ELSIF NEW.status = 'arriving' AND OLD.status IS DISTINCT FROM 'arriving' THEN
    INSERT INTO public.notifications (user_id, title, body, url)
    VALUES (NEW.rider_id, 'Your driver has arrived', 'Meet your driver at the pickup point.', '/ride');
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $$;

-- Direct-update guard: block targeting columns + enforce 1 km rule on rider direct cancels
CREATE OR REPLACE FUNCTION public.protect_ride_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF current_user <> 'authenticated' THEN RETURN NEW; END IF;
  IF public.has_role(uid,'admin') THEN RETURN NEW; END IF;

  IF NEW.rider_id IS DISTINCT FROM OLD.rider_id OR NEW.driver_id IS DISTINCT FROM OLD.driver_id
     OR NEW.vehicle_type IS DISTINCT FROM OLD.vehicle_type
     OR NEW.pickup_lat IS DISTINCT FROM OLD.pickup_lat OR NEW.pickup_lng IS DISTINCT FROM OLD.pickup_lng
     OR NEW.pickup_address IS DISTINCT FROM OLD.pickup_address
     OR NEW.dropoff_lat IS DISTINCT FROM OLD.dropoff_lat OR NEW.dropoff_lng IS DISTINCT FROM OLD.dropoff_lng
     OR NEW.dropoff_address IS DISTINCT FROM OLD.dropoff_address
     OR NEW.distance_km IS DISTINCT FROM OLD.distance_km OR NEW.duration_min IS DISTINCT FROM OLD.duration_min
     OR NEW.payment_method IS DISTINCT FROM OLD.payment_method OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
     OR NEW.accepted_at IS DISTINCT FROM OLD.accepted_at OR NEW.requested_at IS DISTINCT FROM OLD.requested_at
     OR NEW.promo_code IS DISTINCT FROM OLD.promo_code
     OR NEW.tip IS DISTINCT FROM OLD.tip OR NEW.fare_estimate IS DISTINCT FROM OLD.fare_estimate
     OR NEW.discount IS DISTINCT FROM OLD.discount OR NEW.final_fare IS DISTINCT FROM OLD.final_fare
     OR NEW.commission IS DISTINCT FROM OLD.commission OR NEW.driver_earnings IS DISTINCT FROM OLD.driver_earnings
     OR NEW.fare_offer IS DISTINCT FROM OLD.fare_offer OR NEW.extras_fee IS DISTINCT FROM OLD.extras_fee
     OR NEW.passengers IS DISTINCT FROM OLD.passengers OR NEW.extra_baggage IS DISTINCT FROM OLD.extra_baggage
     OR NEW.target_driver_id IS DISTINCT FROM OLD.target_driver_id OR NEW.target_status IS DISTINCT FROM OLD.target_status
     OR NEW.target_expires_at IS DISTINCT FROM OLD.target_expires_at THEN
    RAISE EXCEPTION 'This trip detail cannot be changed';
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    IF NEW.started_at IS DISTINCT FROM OLD.started_at OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
       OR NEW.cancel_reason IS DISTINCT FROM OLD.cancel_reason OR NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by THEN
      RAISE EXCEPTION 'This trip detail cannot be changed';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'completed' THEN RAISE EXCEPTION 'Trips can only be completed by the driver''s Complete button'; END IF;
  IF NEW.status = 'accepted' THEN RAISE EXCEPTION 'Rides can only be accepted from the request screen'; END IF;

  IF uid = OLD.rider_id AND NEW.status = 'cancelled' AND OLD.status IN ('requested','accepted','arriving') THEN
    IF public.rider_cancel_blocked(OLD.id) THEN
      RAISE EXCEPTION 'Your driver is almost there — cancelling now isn''t available.';
    END IF;
    NEW.cancelled_at := now(); NEW.started_at := OLD.started_at; NEW.cancelled_by := 'rider';
    NEW.cancel_reason := left(COALESCE(NULLIF(trim(NEW.cancel_reason),''),'Cancelled by rider'),300);
    RETURN NEW;
  END IF;
  IF uid = OLD.driver_id THEN
    IF OLD.status = 'accepted' AND NEW.status = 'arriving' THEN
      NEW.started_at := OLD.started_at; NEW.cancelled_at := OLD.cancelled_at; NEW.cancel_reason := OLD.cancel_reason; NEW.cancelled_by := OLD.cancelled_by; RETURN NEW;
    ELSIF OLD.status = 'arriving' AND NEW.status = 'in_progress' THEN
      NEW.started_at := now(); NEW.cancelled_at := OLD.cancelled_at; NEW.cancel_reason := OLD.cancel_reason; NEW.cancelled_by := OLD.cancelled_by; RETURN NEW;
    ELSIF OLD.status IN ('accepted','arriving') AND NEW.status = 'cancelled' THEN
      NEW.cancelled_at := now(); NEW.started_at := OLD.started_at; NEW.cancelled_by := 'driver';
      NEW.cancel_reason := left(COALESCE(NULLIF(trim(NEW.cancel_reason),''),'Cancelled by driver'),300);
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'Trip status can''t change from % to %', OLD.status, NEW.status;
END; $$;

-- Drivers only see open broadcast requests, or pending direct requests aimed at them
DROP POLICY IF EXISTS "driver reads assigned or open rides" ON public.rides;
CREATE POLICY "driver reads assigned or open rides" ON public.rides FOR SELECT TO authenticated
USING (
  driver_id = auth.uid()
  OR (
    status = 'requested'
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid() AND d.status = 'approved')
    AND public.driver_vehicle_type(auth.uid()) = vehicle_type
    AND (target_driver_id IS NULL OR (target_driver_id = auth.uid() AND target_status = 'pending'))
  )
);

-- Choose-your-driver list (no phone, no plate, coordinates rounded ~1 km)
CREATE OR REPLACE FUNCTION public.drivers_for_pickup(_lat double precision, _lng double precision, _type vehicle_type)
RETURNS TABLE(driver_id uuid, full_name text, avatar_url text, rating numeric, rating_count integer,
              vehicle text, distance_km double precision, approx_lat double precision, approx_lng double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.user_id, split_part(p.full_name,' ',1) || CASE WHEN position(' ' in p.full_name) > 0 THEN ' ' || left(split_part(p.full_name,' ',2),1) || '.' ELSE '' END,
    p.avatar_url, p.rating, p.rating_count,
    (SELECT v.color || ' ' || v.make || ' ' || v.model FROM public.vehicles v WHERE v.driver_id = d.id ORDER BY v.created_at DESC LIMIT 1),
    round(public.haversine_km(_lat,_lng,dl.lat,dl.lng)::numeric, 1)::double precision,
    round(dl.lat::numeric, 2)::double precision, round(dl.lng::numeric, 2)::double precision
  FROM public.drivers d
  JOIN public.driver_locations dl ON dl.driver_id = d.user_id
  JOIN public.profiles p ON p.id = d.user_id
  WHERE auth.uid() IS NOT NULL AND d.user_id <> auth.uid()
    AND public.in_service_area(_lat, _lng)
    AND public.in_service_area(dl.lat, dl.lng)
    AND public.driver_available_for(d.user_id, _type)
    AND public.haversine_km(_lat,_lng,dl.lat,dl.lng) <= 15
  ORDER BY 7 ASC
  LIMIT 30;
$$;
REVOKE EXECUTE ON FUNCTION public.drivers_for_pickup(double precision, double precision, vehicle_type) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.drivers_for_pickup(double precision, double precision, vehicle_type) TO authenticated;

-- Nearby riders directory for drivers (no id/name/address/exact pin)
CREATE OR REPLACE FUNCTION public.nearby_ride_requests()
RETURNS TABLE(area text, vehicle_type vehicle_type, distance_km double precision, requested_at timestamptz, direct_to_me boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE((SELECT 'Near ' || sa.name FROM public.service_areas sa WHERE sa.active
              ORDER BY public.haversine_km(r.pickup_lat, r.pickup_lng, sa.center_lat, sa.center_lng) LIMIT 1), 'Nearby'),
    r.vehicle_type,
    round(public.haversine_km(dl.lat, dl.lng, r.pickup_lat, r.pickup_lng)::numeric, 1)::double precision,
    r.requested_at,
    r.target_driver_id = auth.uid()
  FROM public.driver_locations dl
  JOIN public.drivers d ON d.user_id = dl.driver_id AND d.status = 'approved'
  JOIN public.rides r ON r.status = 'requested' AND r.requested_at > now() - interval '2 minutes'
  WHERE dl.driver_id = auth.uid() AND r.rider_id <> auth.uid()
    AND public.haversine_km(dl.lat, dl.lng, r.pickup_lat, r.pickup_lng) <= 5
  ORDER BY 3 ASC
  LIMIT 50;
$$;
REVOKE EXECUTE ON FUNCTION public.nearby_ride_requests() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.nearby_ride_requests() TO authenticated;

-- ===== Community pins =====
CREATE TABLE public.community_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 60),
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('landmark','gate','meeting point','other')),
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_pins TO authenticated;
GRANT ALL ON public.community_pins TO service_role;
ALTER TABLE public.community_pins ENABLE ROW LEVEL SECURITY;
CREATE INDEX community_pins_creator_idx ON public.community_pins(created_by, created_at);

CREATE POLICY "read visible pins" ON public.community_pins FOR SELECT TO authenticated
  USING (NOT is_hidden OR created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "create own pins" ON public.community_pins FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND NOT is_hidden);
CREATE POLICY "edit own pins" ON public.community_pins FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "delete own pins" ON public.community_pins FOR DELETE TO authenticated
  USING (created_by = auth.uid());
CREATE POLICY "admin manages pins" ON public.community_pins FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.guard_community_pin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.name := trim(NEW.name);
  IF public.has_role(auth.uid(),'admin') OR auth.uid() IS NULL THEN
    NEW.updated_at := now(); RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid(); NEW.is_hidden := false; NEW.created_at := now();
    IF NOT public.in_service_area(NEW.lat, NEW.lng) THEN
      RAISE EXCEPTION 'Pins can only be saved inside the Zoomo service area';
    END IF;
    IF (SELECT count(*) FROM public.community_pins WHERE created_by = auth.uid() AND created_at > now() - interval '1 day') >= 10 THEN
      RAISE EXCEPTION 'Daily limit reached — you can save up to 10 pins per day';
    END IF;
  ELSE
    IF NEW.is_hidden IS DISTINCT FROM OLD.is_hidden OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Only admins can change that';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_community_pin BEFORE INSERT OR UPDATE ON public.community_pins
  FOR EACH ROW EXECUTE FUNCTION public.guard_community_pin();

ALTER PUBLICATION supabase_realtime ADD TABLE public.community_pins;