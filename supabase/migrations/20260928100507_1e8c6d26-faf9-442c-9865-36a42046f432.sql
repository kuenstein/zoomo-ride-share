-- lovable-cron-fallback-reviewed: expiry is already enforced from requested_at in accept_ride and driver lists; this 5-minute job only persists the status as a backstop
-- ========== 1. Consent & deletion ==========
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_version text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE OR REPLACE FUNCTION public.accept_terms(_version text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _version IS NULL OR length(trim(_version)) = 0 OR length(_version) > 40 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid version');
  END IF;
  UPDATE public.profiles SET consent_at = now(), consent_version = trim(_version) WHERE id = auth.uid();
  RETURN jsonb_build_object('success', true);
END; $$;
REVOKE EXECUTE ON FUNCTION public.accept_terms(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.accept_terms(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE r public.app_role; cv text := left(NULLIF(trim(NEW.raw_user_meta_data->>'consent_version'),''),40);
BEGIN
  r := CASE WHEN lower(coalesce(NEW.raw_user_meta_data->>'role','')) = 'driver' THEN 'driver'::public.app_role
            ELSE 'rider'::public.app_role END;
  INSERT INTO public.profiles (id, full_name, phone, avatar_url, consent_at, consent_version)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'phone', NEW.raw_user_meta_data->>'avatar_url',
    CASE WHEN cv IS NOT NULL THEN now() END, cv)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.wallets (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, r) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $function$;

-- Users cannot forge consent/deletion fields via direct profile update
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    NEW.consent_at := OLD.consent_at; NEW.consent_version := OLD.consent_version;
    NEW.deleted_at := OLD.deleted_at; NEW.rating := OLD.rating; NEW.rating_count := OLD.rating_count;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS profiles_protect_fields ON public.profiles;
CREATE TRIGGER profiles_protect_fields BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

-- ========== 2. Driver documents ==========
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS license_expiry date;

CREATE TABLE public.driver_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  doc_type text NOT NULL CHECK (doc_type IN ('license','orcr','vehicle','selfie')),
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewer_notes text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, doc_type)
);
GRANT SELECT, INSERT, UPDATE ON public.driver_documents TO authenticated;
GRANT ALL ON public.driver_documents TO service_role;
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs owner read" ON public.driver_documents FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "docs owner insert" ON public.driver_documents FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND storage_path LIKE auth.uid()::text || '/%');
CREATE POLICY "docs owner or admin update" ON public.driver_documents FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK ((user_id = auth.uid() AND storage_path LIKE auth.uid()::text || '/%') OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.protect_driver_documents()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(),'admin') AND TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN NEW.reviewed_at := now(); END IF;
    NEW.reviewer_notes := left(NEW.reviewer_notes, 500);
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.user_id := OLD.user_id; NEW.doc_type := OLD.doc_type;
    IF NEW.storage_path IS DISTINCT FROM OLD.storage_path THEN
      NEW.status := 'pending'; NEW.reviewer_notes := NULL; NEW.reviewed_at := NULL;
    ELSE
      NEW.status := OLD.status; NEW.reviewer_notes := OLD.reviewer_notes; NEW.reviewed_at := OLD.reviewed_at;
    END IF;
  ELSE
    NEW.status := 'pending'; NEW.reviewer_notes := NULL; NEW.reviewed_at := NULL;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER driver_documents_protect BEFORE INSERT OR UPDATE ON public.driver_documents
  FOR EACH ROW EXECUTE FUNCTION public.protect_driver_documents();
CREATE TRIGGER driver_documents_updated BEFORE UPDATE ON public.driver_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.driver_docs_complete(_user_id uuid, _approved_only boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(DISTINCT doc_type) = 4 FROM public.driver_documents
  WHERE user_id = _user_id AND (NOT _approved_only OR status = 'approved');
$$;

CREATE OR REPLACE FUNCTION public.driver_license_expired(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT license_expiry < (now() AT TIME ZONE 'Asia/Manila')::date FROM public.drivers WHERE user_id = _user_id), false);
$$;

CREATE OR REPLACE FUNCTION public.protect_driver_status()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    NEW.status = OLD.status;
    IF OLD.status = 'approved' THEN NEW.license_expiry := OLD.license_expiry; END IF;
  END IF;
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved'
     AND NOT public.driver_docs_complete(NEW.user_id, true) THEN
    RAISE EXCEPTION 'All four driver documents must be approved before approving this driver';
  END IF;
  IF NEW.is_online AND NOT COALESCE(OLD.is_online,false) AND public.driver_license_expired(NEW.user_id) THEN
    RAISE EXCEPTION 'Your driver''s license has expired. Upload a renewed license to go online.';
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.require_driver_docs_on_apply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') AND NOT public.driver_docs_complete(NEW.user_id, false) THEN
    RAISE EXCEPTION 'Upload all four documents before submitting your application';
  END IF;
  IF NOT public.has_role(auth.uid(),'admin') THEN NEW.status := 'pending'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS drivers_require_docs ON public.drivers;
CREATE TRIGGER drivers_require_docs BEFORE INSERT ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.require_driver_docs_on_apply();

CREATE OR REPLACE FUNCTION public.accept_ride(_ride_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE updated INT; vt vehicle_type;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.drivers WHERE user_id = auth.uid() AND status='approved') THEN
    RETURN jsonb_build_object('success', false, 'message','Driver not approved');
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
  IF updated = 0 THEN RETURN jsonb_build_object('success', false, 'message','Ride already taken or expired'); END IF;
  INSERT INTO public.notifications (user_id, title, body)
  SELECT rider_id, 'Driver found!', 'Your driver is on the way.' FROM public.rides WHERE id = _ride_id;
  RETURN jsonb_build_object('success', true);
END; $function$;

-- ========== 3. Safety, reports, trusted contacts ==========
CREATE TABLE public.safety_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.rides(id),
  reporter_id uuid NOT NULL,
  reporter_role text NOT NULL CHECK (reporter_role IN ('rider','driver')),
  lat double precision, lng double precision,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.safety_incidents TO authenticated;
GRANT ALL ON public.safety_incidents TO service_role;
ALTER TABLE public.safety_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "incidents reporter or admin read" ON public.safety_incidents FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "incidents admin update" ON public.safety_incidents FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER safety_incidents_updated BEFORE UPDATE ON public.safety_incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.raise_sos(_ride_id uuid, _lat double precision DEFAULT NULL, _lng double precision DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rides; role text; iid uuid;
BEGIN
  SELECT * INTO r FROM public.rides WHERE id = _ride_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'message','Trip not found'); END IF;
  IF r.rider_id = auth.uid() THEN role := 'rider';
  ELSIF r.driver_id = auth.uid() THEN role := 'driver';
  ELSE RETURN jsonb_build_object('success',false,'message','Not your trip'); END IF;
  IF r.status NOT IN ('accepted','arriving','in_progress') THEN
    RETURN jsonb_build_object('success',false,'message','SOS is available during an active trip');
  END IF;
  IF _lat IS NOT NULL AND (_lat < -90 OR _lat > 90 OR _lng < -180 OR _lng > 180) THEN _lat := NULL; _lng := NULL; END IF;
  INSERT INTO public.safety_incidents (ride_id, reporter_id, reporter_role, lat, lng)
  VALUES (_ride_id, auth.uid(), role, _lat, _lng) RETURNING id INTO iid;
  INSERT INTO public.notifications (user_id, title, body)
  SELECT ur.user_id, 'SOS alert', 'A ' || role || ' pressed SOS on an active trip.' FROM public.user_roles ur WHERE ur.role = 'admin';
  RETURN jsonb_build_object('success',true,'id',iid);
END; $$;
REVOKE EXECUTE ON FUNCTION public.raise_sos(uuid,double precision,double precision) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.raise_sos(uuid,double precision,double precision) TO authenticated;

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.rides(id),
  reporter_id uuid NOT NULL,
  category text NOT NULL CHECK (category IN ('overcharge','rude','unsafe_driving','lost_item','other')),
  details text NOT NULL CHECK (length(details) BETWEEN 1 AND 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports reporter or admin read" ON public.reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "reports insert own completed trip" ON public.reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND status = 'open' AND admin_notes IS NULL AND EXISTS (
    SELECT 1 FROM public.rides r WHERE r.id = ride_id AND r.status = 'completed'
      AND (r.rider_id = auth.uid() OR r.driver_id = auth.uid())));
CREATE POLICY "reports admin update" ON public.reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER reports_updated BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.trusted_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  phone text NOT NULL CHECK (length(phone) BETWEEN 7 AND 20),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trusted_contacts TO authenticated;
GRANT ALL ON public.trusted_contacts TO service_role;
ALTER TABLE public.trusted_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trusted contacts owner" ON public.trusted_contacts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ========== 4. Push ==========
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push subs owner" ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS pushed_at timestamptz;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS url text;

CREATE TABLE public.app_config (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.app_config TO authenticated;
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app config admin" ON public.app_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.app_config (key, value) VALUES
  ('push_dispatch_url', 'https://project--9795e10e-ab5f-4098-b40f-acbf3535f7c6-dev.lovable.app/api/public/push-dispatch')
ON CONFLICT DO NOTHING;

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.dispatch_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u text;
BEGIN
  SELECT value INTO u FROM public.app_config WHERE key = 'push_dispatch_url';
  IF u IS NOT NULL AND length(u) > 0 AND EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id = NEW.user_id) THEN
    PERFORM net.http_post(url := u, body := jsonb_build_object('id', NEW.id),
      headers := '{"Content-Type":"application/json"}'::jsonb);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $$;
CREATE TRIGGER notifications_dispatch_push AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_push();

CREATE OR REPLACE FUNCTION public.notify_ride_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, title, body, url)
    SELECT nd.driver_id, 'New ride request',
      CASE WHEN NEW.vehicle_type::text = 'tricycle' THEN 'Tricycle' ELSE 'Motorcycle' END || ' trip from ' || left(NEW.pickup_address, 80),
      '/driver'
    FROM public.nearby_drivers(NEW.pickup_lat, NEW.pickup_lng, 5) nd
    WHERE public.driver_vehicle_type(nd.driver_id) = NEW.vehicle_type
      AND nd.driver_id <> NEW.rider_id;
  ELSIF NEW.status = 'arriving' AND OLD.status IS DISTINCT FROM 'arriving' THEN
    INSERT INTO public.notifications (user_id, title, body, url)
    VALUES (NEW.rider_id, 'Your driver has arrived', 'Meet your driver at the pickup point.', '/ride');
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $$;
CREATE TRIGGER rides_notify_events AFTER INSERT OR UPDATE OF status ON public.rides
  FOR EACH ROW EXECUTE FUNCTION public.notify_ride_events();

CREATE OR REPLACE FUNCTION public.notify_driver_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','rejected','suspended') THEN
    INSERT INTO public.notifications (user_id, title, body, url) VALUES (NEW.user_id,
      CASE NEW.status WHEN 'approved' THEN 'You''re approved!' WHEN 'rejected' THEN 'Application not approved' ELSE 'Account suspended' END,
      CASE NEW.status WHEN 'approved' THEN 'Go online to start receiving ride requests.'
        ELSE COALESCE(NULLIF(NEW.rejection_reason,''),'Open Zoomo for details.') END, '/driver');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER drivers_notify_status AFTER UPDATE OF status ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.notify_driver_status();

-- ========== 5. Geo cache & rate limit (server only) ==========
CREATE TABLE public.geo_cache (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.geo_cache TO service_role;
ALTER TABLE public.geo_cache ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.geo_rate (
  user_id uuid NOT NULL,
  bucket timestamptz NOT NULL,
  hits int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, bucket)
);
GRANT ALL ON public.geo_rate TO service_role;
ALTER TABLE public.geo_rate ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.geo_hit(_user uuid, _limit int)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int; b timestamptz := date_trunc('minute', now());
BEGIN
  INSERT INTO public.geo_rate (user_id, bucket, hits) VALUES (_user, b, 1)
  ON CONFLICT (user_id, bucket) DO UPDATE SET hits = public.geo_rate.hits + 1 RETURNING hits INTO n;
  IF random() < 0.01 THEN
    DELETE FROM public.geo_rate WHERE bucket < now() - interval '1 hour';
    DELETE FROM public.geo_cache WHERE created_at < now() - interval '7 days';
  END IF;
  RETURN n <= _limit;
END; $$;
REVOKE EXECUTE ON FUNCTION public.geo_hit(uuid,int) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.geo_hit(uuid,int) TO service_role;

-- ========== 6. Scheduled expiry ==========
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('zoomo-expire-stale-rides', '*/5 * * * *', 'select public.expire_stale_rides()');

-- ========== Launch status (admin) ==========
CREATE OR REPLACE FUNCTION public.launch_db_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb; job_ok boolean := false; last_run timestamptz; last_status text;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  BEGIN
    SELECT true INTO job_ok FROM cron.job WHERE jobname = 'zoomo-expire-stale-rides' AND active LIMIT 1;
    SELECT d.start_time, d.status INTO last_run, last_status FROM cron.job_run_details d
      JOIN cron.job j ON j.jobid = d.jobid WHERE j.jobname = 'zoomo-expire-stale-rides'
      ORDER BY d.start_time DESC LIMIT 1;
  EXCEPTION WHEN OTHERS THEN job_ok := false;
  END;
  SELECT jsonb_build_object(
    'approved_drivers', (SELECT count(*) FROM public.drivers WHERE status='approved'),
    'active_areas', (SELECT count(*) FROM public.service_areas WHERE active),
    'admins', (SELECT count(*) FROM public.user_roles WHERE role='admin'),
    'last_paid_topup', (SELECT max(paid_at) FROM public.payment_checkouts WHERE status='paid' AND method='qrph'),
    'pricing', (SELECT jsonb_build_object('tricycle_base', base_fare_tricycle, 'tricycle_km', per_km_tricycle,
       'bike_base', base_fare_bike, 'bike_km', per_km_bike, 'commission', commission_percent, 'updated_at', updated_at)
       FROM public.pricing_settings WHERE id=1),
    'expiry_job', COALESCE(job_ok,false),
    'expiry_last_run', last_run,
    'expiry_last_status', last_status,
    'push_dispatch_url', (SELECT value FROM public.app_config WHERE key='push_dispatch_url'),
    'push_subscriptions', (SELECT count(*) FROM public.push_subscriptions)
  ) INTO res;
  RETURN res;
END; $$;
REVOKE EXECUTE ON FUNCTION public.launch_db_status() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.launch_db_status() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.driver_docs_complete(uuid,boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.driver_license_expired(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.driver_docs_complete(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_license_expired(uuid) TO authenticated;

-- ========== Realtime ==========
ALTER PUBLICATION supabase_realtime ADD TABLE public.safety_incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;

-- ========== Storage policies for driver-documents bucket ==========
CREATE POLICY "driver docs owner upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'driver-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "driver docs owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'driver-documents' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'driver-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "driver docs owner or admin read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'driver-documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "driver docs owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'driver-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
