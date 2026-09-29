CREATE OR REPLACE FUNCTION public.accept_ride(_ride_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE updated INT; vt vehicle_type;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success', false, 'message','Not signed in'); END IF;
  -- serialize accepts per driver so two parallel accepts can't both succeed
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
  UPDATE public.rides SET driver_id = auth.uid(), status='accepted', accepted_at = now()
  WHERE id = _ride_id AND status='requested' AND driver_id IS NULL AND vehicle_type = vt
    AND requested_at > now() - interval '2 minutes';
  GET DIAGNOSTICS updated = ROW_COUNT;
  IF updated = 0 THEN RETURN jsonb_build_object('success', false, 'code','taken', 'message','Ride already taken or expired'); END IF;
  INSERT INTO public.notifications (user_id, title, body)
  SELECT rider_id, 'Driver found!', 'Your driver is on the way.' FROM public.rides WHERE id = _ride_id;
  RETURN jsonb_build_object('success', true);
END; $function$;

-- Hard guarantee: a driver can hold at most one non-terminal ride
CREATE UNIQUE INDEX IF NOT EXISTS rides_one_active_per_driver
  ON public.rides (driver_id) WHERE status IN ('accepted','arriving','in_progress');