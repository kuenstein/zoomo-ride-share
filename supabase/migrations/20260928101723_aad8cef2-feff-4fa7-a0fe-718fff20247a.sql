CREATE OR REPLACE FUNCTION public.raise_sos(_ride_id uuid, _lat double precision DEFAULT NULL, _lng double precision DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rides; rep_role text; iid uuid;
BEGIN
  SELECT * INTO r FROM public.rides WHERE id = _ride_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'message','Trip not found'); END IF;
  IF r.rider_id = auth.uid() THEN rep_role := 'rider';
  ELSIF r.driver_id = auth.uid() THEN rep_role := 'driver';
  ELSE RETURN jsonb_build_object('success',false,'message','Not your trip'); END IF;
  IF r.status NOT IN ('accepted','arriving','in_progress') THEN
    RETURN jsonb_build_object('success',false,'message','SOS is available during an active trip');
  END IF;
  IF _lat IS NOT NULL AND (_lat < -90 OR _lat > 90 OR _lng < -180 OR _lng > 180) THEN _lat := NULL; _lng := NULL; END IF;
  INSERT INTO public.safety_incidents (ride_id, reporter_id, reporter_role, lat, lng)
  VALUES (_ride_id, auth.uid(), rep_role, _lat, _lng) RETURNING id INTO iid;
  INSERT INTO public.notifications (user_id, title, body, url)
  SELECT ur.user_id, 'SOS alert', 'A ' || rep_role || ' pressed SOS on an active trip.', '/admin'
  FROM public.user_roles ur WHERE ur.role = 'admin';
  RETURN jsonb_build_object('success',true,'id',iid);
END; $$;
REVOKE EXECUTE ON FUNCTION public.raise_sos(uuid,double precision,double precision) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.raise_sos(uuid,double precision,double precision) TO authenticated;