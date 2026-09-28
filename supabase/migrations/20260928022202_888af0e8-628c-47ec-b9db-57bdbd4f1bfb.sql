
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('rider','driver','admin');
CREATE TYPE public.driver_status AS ENUM ('pending','approved','rejected','suspended');
CREATE TYPE public.ride_status AS ENUM ('requested','accepted','arriving','in_progress','completed','cancelled','expired');
CREATE TYPE public.vehicle_type AS ENUM ('economy','comfort','xl','bike');
CREATE TYPE public.payment_method AS ENUM ('cash','card','wallet');

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  avatar_url TEXT,
  rating NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  rating_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "own profile write" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "claim rider or driver role" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND role <> 'admin');

-- DRIVERS
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,
  license_number TEXT NOT NULL,
  status public.driver_status NOT NULL DEFAULT 'pending',
  is_online BOOLEAN NOT NULL DEFAULT false,
  total_trips INT NOT NULL DEFAULT 0,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drivers readable" ON public.drivers FOR SELECT TO authenticated USING (true);
CREATE POLICY "driver self insert" ON public.drivers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "driver self update" ON public.drivers FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin manage drivers" ON public.drivers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER drivers_updated BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- prevent drivers self-approving
CREATE OR REPLACE FUNCTION public.protect_driver_status() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN NEW.status = OLD.status; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER drivers_protect_status BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.protect_driver_status();

-- VEHICLES
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  type public.vehicle_type NOT NULL DEFAULT 'economy',
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  color TEXT NOT NULL,
  plate TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicles readable" ON public.vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "vehicle owner write" ON public.vehicles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));

-- PRICING
CREATE TABLE public.pricing_settings (
  id INT PRIMARY KEY DEFAULT 1,
  base_fare NUMERIC(10,2) NOT NULL DEFAULT 2.50,
  per_km NUMERIC(10,2) NOT NULL DEFAULT 1.20,
  per_minute NUMERIC(10,2) NOT NULL DEFAULT 0.30,
  minimum_fare NUMERIC(10,2) NOT NULL DEFAULT 4.00,
  commission_percent NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  multiplier_economy NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  multiplier_comfort NUMERIC(4,2) NOT NULL DEFAULT 1.35,
  multiplier_xl NUMERIC(4,2) NOT NULL DEFAULT 1.70,
  multiplier_bike NUMERIC(4,2) NOT NULL DEFAULT 0.70,
  currency TEXT NOT NULL DEFAULT 'USD',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pricing_singleton CHECK (id = 1)
);
GRANT SELECT ON public.pricing_settings TO authenticated, anon;
GRANT ALL ON public.pricing_settings TO service_role;
ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing public read" ON public.pricing_settings FOR SELECT USING (true);
CREATE POLICY "pricing admin write" ON public.pricing_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
GRANT UPDATE ON public.pricing_settings TO authenticated;
INSERT INTO public.pricing_settings (id) VALUES (1);

-- PROMO CODES
CREATE TABLE public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent','flat')),
  discount_value NUMERIC(10,2) NOT NULL,
  max_discount NUMERIC(10,2),
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  usage_limit INT,
  times_used INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_codes TO authenticated;
GRANT ALL ON public.promo_codes TO service_role;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promo admin all" ON public.promo_codes FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.promo_codes (code, discount_type, discount_value, max_discount) VALUES
  ('WELCOME10','percent',10,5),
  ('FIRST5','flat',5,NULL);

-- RIDES
CREATE TABLE public.rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  driver_id UUID REFERENCES auth.users ON DELETE SET NULL,
  status public.ride_status NOT NULL DEFAULT 'requested',
  vehicle_type public.vehicle_type NOT NULL DEFAULT 'economy',
  pickup_lat DOUBLE PRECISION NOT NULL,
  pickup_lng DOUBLE PRECISION NOT NULL,
  pickup_address TEXT NOT NULL,
  dropoff_lat DOUBLE PRECISION NOT NULL,
  dropoff_lng DOUBLE PRECISION NOT NULL,
  dropoff_address TEXT NOT NULL,
  distance_km NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration_min NUMERIC(10,2) NOT NULL DEFAULT 0,
  fare_estimate NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  promo_code TEXT,
  final_fare NUMERIC(10,2),
  tip NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission NUMERIC(10,2) NOT NULL DEFAULT 0,
  driver_earnings NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  cancel_reason TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX rides_status_idx ON public.rides(status);
CREATE INDEX rides_rider_idx ON public.rides(rider_id);
CREATE INDEX rides_driver_idx ON public.rides(driver_id);
GRANT SELECT, INSERT, UPDATE ON public.rides TO authenticated;
GRANT ALL ON public.rides TO service_role;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER rides_updated BEFORE UPDATE ON public.rides FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "rider reads own rides" ON public.rides FOR SELECT TO authenticated USING (rider_id = auth.uid());
CREATE POLICY "driver reads assigned or open rides" ON public.rides FOR SELECT TO authenticated USING (
  driver_id = auth.uid()
  OR (status = 'requested' AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid() AND d.status = 'approved'))
);
CREATE POLICY "admin reads all rides" ON public.rides FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "rider creates ride" ON public.rides FOR INSERT TO authenticated WITH CHECK (rider_id = auth.uid());
CREATE POLICY "rider updates own ride" ON public.rides FOR UPDATE TO authenticated USING (rider_id = auth.uid()) WITH CHECK (rider_id = auth.uid());
CREATE POLICY "driver updates assigned ride" ON public.rides FOR UPDATE TO authenticated USING (driver_id = auth.uid()) WITH CHECK (driver_id = auth.uid());
CREATE POLICY "admin updates rides" ON public.rides FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- RIDE MESSAGES
CREATE TABLE public.ride_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ride_messages TO authenticated;
GRANT ALL ON public.ride_messages TO service_role;
ALTER TABLE public.ride_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ride participants read messages" ON public.ride_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_id AND (r.rider_id = auth.uid() OR r.driver_id = auth.uid()))
  OR public.has_role(auth.uid(),'admin')
);
CREATE POLICY "ride participants send messages" ON public.ride_messages FOR INSERT TO authenticated WITH CHECK (
  sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_id AND (r.rider_id = auth.uid() OR r.driver_id = auth.uid()))
);

-- DRIVER LOCATIONS
CREATE TABLE public.driver_locations (
  driver_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  heading NUMERIC(6,2),
  is_online BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.driver_locations TO authenticated;
GRANT ALL ON public.driver_locations TO service_role;
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "driver writes own location" ON public.driver_locations FOR ALL TO authenticated USING (driver_id = auth.uid()) WITH CHECK (driver_id = auth.uid());
CREATE POLICY "locations readable by authenticated" ON public.driver_locations FOR SELECT TO authenticated USING (true);

-- RATINGS
CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  ratee_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  stars INT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ride_id, rater_id)
);
GRANT SELECT, INSERT ON public.ratings TO authenticated;
GRANT ALL ON public.ratings TO service_role;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ratings readable" ON public.ratings FOR SELECT TO authenticated USING (rater_id = auth.uid() OR ratee_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "create own rating" ON public.ratings FOR INSERT TO authenticated WITH CHECK (rater_id = auth.uid());

CREATE OR REPLACE FUNCTION public.apply_rating() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles
  SET rating_count = rating_count + 1,
      rating = ROUND(((rating * rating_count) + NEW.stars) / (rating_count + 1), 2)
  WHERE id = NEW.ratee_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER ratings_apply AFTER INSERT ON public.ratings FOR EACH ROW EXECUTE FUNCTION public.apply_rating();

-- WALLETS
CREATE TABLE public.wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wallet read" ON public.wallets FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  kind TEXT NOT NULL,
  description TEXT,
  ride_id UUID REFERENCES public.rides(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transactions read" ON public.wallet_transactions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- SAVED PLACES
CREATE TABLE public.saved_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  label TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_places TO authenticated;
GRANT ALL ON public.saved_places TO service_role;
ALTER TABLE public.saved_places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own saved places" ON public.saved_places FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- NEW USER TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, avatar_url)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.wallets (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data->>'role',''),'rider')::public.app_role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- HAVERSINE
CREATE OR REPLACE FUNCTION public.haversine_km(lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION, lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION)
RETURNS DOUBLE PRECISION LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2-lat1)/2),2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2-lng1)/2),2)
  ));
$$;

-- FARE
CREATE OR REPLACE FUNCTION public.calculate_fare(_type public.vehicle_type, _km NUMERIC, _min NUMERIC)
RETURNS NUMERIC LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.pricing_settings; m NUMERIC; f NUMERIC;
BEGIN
  SELECT * INTO p FROM public.pricing_settings WHERE id = 1;
  m := CASE _type WHEN 'economy' THEN p.multiplier_economy WHEN 'comfort' THEN p.multiplier_comfort
       WHEN 'xl' THEN p.multiplier_xl ELSE p.multiplier_bike END;
  f := (p.base_fare + p.per_km * COALESCE(_km,0) + p.per_minute * COALESCE(_min,0)) * m;
  RETURN ROUND(GREATEST(f, p.minimum_fare * m), 2);
END; $$;

-- PROMO VALIDATION
CREATE OR REPLACE FUNCTION public.validate_promo(_code TEXT, _amount NUMERIC)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE pc public.promo_codes; d NUMERIC;
BEGIN
  SELECT * INTO pc FROM public.promo_codes WHERE upper(code) = upper(trim(_code)) AND active;
  IF NOT FOUND THEN RETURN jsonb_build_object('valid', false, 'message','Invalid promo code'); END IF;
  IF pc.expires_at IS NOT NULL AND pc.expires_at < now() THEN RETURN jsonb_build_object('valid', false,'message','Promo code expired'); END IF;
  IF pc.usage_limit IS NOT NULL AND pc.times_used >= pc.usage_limit THEN RETURN jsonb_build_object('valid', false,'message','Promo code fully used'); END IF;
  IF pc.discount_type = 'percent' THEN d := _amount * pc.discount_value / 100.0;
    IF pc.max_discount IS NOT NULL THEN d := LEAST(d, pc.max_discount); END IF;
  ELSE d := pc.discount_value; END IF;
  d := ROUND(LEAST(d, _amount), 2);
  RETURN jsonb_build_object('valid', true, 'code', pc.code, 'discount', d, 'message','Promo applied');
END; $$;

-- SERVER-SIDE FARE ENFORCEMENT ON INSERT
CREATE OR REPLACE FUNCTION public.enforce_ride_fare() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE est NUMERIC; promo JSONB;
BEGIN
  est := public.calculate_fare(NEW.vehicle_type, NEW.distance_km, NEW.duration_min);
  NEW.fare_estimate := est;
  NEW.discount := 0;
  IF NEW.promo_code IS NOT NULL AND length(trim(NEW.promo_code)) > 0 THEN
    promo := public.validate_promo(NEW.promo_code, est);
    IF (promo->>'valid')::boolean THEN
      NEW.discount := (promo->>'discount')::numeric;
      NEW.promo_code := promo->>'code';
    ELSE NEW.promo_code := NULL; END IF;
  END IF;
  NEW.status := 'requested';
  NEW.driver_id := NULL;
  RETURN NEW;
END; $$;
CREATE TRIGGER rides_enforce_fare BEFORE INSERT ON public.rides FOR EACH ROW EXECUTE FUNCTION public.enforce_ride_fare();

-- ACCEPT RIDE (atomic)
CREATE OR REPLACE FUNCTION public.accept_ride(_ride_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE updated INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.drivers WHERE user_id = auth.uid() AND status='approved') THEN
    RETURN jsonb_build_object('success', false, 'message','Driver not approved');
  END IF;
  UPDATE public.rides SET driver_id = auth.uid(), status='accepted', accepted_at = now()
  WHERE id = _ride_id AND status='requested' AND driver_id IS NULL;
  GET DIAGNOSTICS updated = ROW_COUNT;
  IF updated = 0 THEN RETURN jsonb_build_object('success', false, 'message','Ride already taken'); END IF;
  INSERT INTO public.notifications (user_id, title, body)
  SELECT rider_id, 'Driver found!', 'Your driver is on the way.' FROM public.rides WHERE id = _ride_id;
  RETURN jsonb_build_object('success', true);
END; $$;

-- COMPLETE TRIP
CREATE OR REPLACE FUNCTION public.complete_ride(_ride_id UUID, _tip NUMERIC DEFAULT 0)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rides; p public.pricing_settings; gross NUMERIC; net NUMERIC; comm NUMERIC; bal NUMERIC;
BEGIN
  SELECT * INTO r FROM public.rides WHERE id = _ride_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false,'message','Ride not found'); END IF;
  IF r.driver_id <> auth.uid() THEN RETURN jsonb_build_object('success', false,'message','Not your ride'); END IF;
  IF r.status = 'completed' THEN RETURN jsonb_build_object('success', true,'message','Already completed'); END IF;
  SELECT * INTO p FROM public.pricing_settings WHERE id = 1;
  gross := GREATEST(r.fare_estimate - r.discount, 0) + GREATEST(COALESCE(_tip,0),0);
  comm := ROUND(gross * p.commission_percent / 100.0, 2);
  net := ROUND(gross - comm, 2);

  IF r.payment_method = 'wallet' THEN
    SELECT balance INTO bal FROM public.wallets WHERE user_id = r.rider_id FOR UPDATE;
    IF COALESCE(bal,0) < gross THEN RETURN jsonb_build_object('success', false,'message','Rider wallet balance too low'); END IF;
    UPDATE public.wallets SET balance = balance - gross, updated_at = now() WHERE user_id = r.rider_id;
    INSERT INTO public.wallet_transactions (user_id, amount, kind, description, ride_id)
    VALUES (r.rider_id, -gross, 'ride_payment', 'Trip payment', r.id);
  END IF;

  INSERT INTO public.wallets (user_id, balance) VALUES (r.driver_id, net)
  ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + net, updated_at = now();
  INSERT INTO public.wallet_transactions (user_id, amount, kind, description, ride_id)
  VALUES (r.driver_id, net, 'earning', 'Trip earnings', r.id);

  UPDATE public.rides SET status='completed', completed_at = now(), final_fare = gross,
    tip = GREATEST(COALESCE(_tip,0),0), commission = comm, driver_earnings = net WHERE id = _ride_id;
  UPDATE public.drivers SET total_trips = total_trips + 1 WHERE user_id = r.driver_id;
  IF r.promo_code IS NOT NULL THEN UPDATE public.promo_codes SET times_used = times_used + 1 WHERE upper(code) = upper(r.promo_code); END IF;
  INSERT INTO public.notifications (user_id, title, body) VALUES (r.rider_id,'Trip completed','Thanks for riding with Zoomo.');
  RETURN jsonb_build_object('success', true, 'fare', gross, 'earnings', net);
END; $$;

-- WALLET TOPUP (simulated)
CREATE OR REPLACE FUNCTION public.wallet_topup(_amount NUMERIC)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE newbal NUMERIC;
BEGIN
  IF _amount IS NULL OR _amount <= 0 OR _amount > 1000 THEN RETURN jsonb_build_object('success', false,'message','Amount must be between 1 and 1000'); END IF;
  INSERT INTO public.wallets (user_id, balance) VALUES (auth.uid(), _amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + _amount, updated_at = now()
  RETURNING balance INTO newbal;
  INSERT INTO public.wallet_transactions (user_id, amount, kind, description) VALUES (auth.uid(), _amount,'topup','Wallet top-up');
  RETURN jsonb_build_object('success', true, 'balance', newbal);
END; $$;

-- NEARBY DRIVERS
CREATE OR REPLACE FUNCTION public.nearby_drivers(_lat DOUBLE PRECISION, _lng DOUBLE PRECISION, _radius_km DOUBLE PRECISION DEFAULT 5)
RETURNS TABLE (driver_id UUID, lat DOUBLE PRECISION, lng DOUBLE PRECISION, distance_km DOUBLE PRECISION)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT dl.driver_id, dl.lat, dl.lng, public.haversine_km(_lat,_lng,dl.lat,dl.lng) AS distance_km
  FROM public.driver_locations dl
  JOIN public.drivers d ON d.user_id = dl.driver_id
  WHERE dl.is_online AND d.is_online AND d.status='approved'
    AND dl.updated_at > now() - interval '2 minutes'
    AND public.haversine_km(_lat,_lng,dl.lat,dl.lng) <= _radius_km
  ORDER BY distance_km ASC;
$$;

-- EXPIRE STALE REQUESTS
CREATE OR REPLACE FUNCTION public.expire_stale_rides()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INT;
BEGIN
  UPDATE public.rides SET status='expired'
  WHERE status='requested' AND requested_at < now() - interval '2 minutes';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;

-- ADMIN STATS
CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE res JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT jsonb_build_object(
    'rides_today', (SELECT count(*) FROM public.rides WHERE created_at::date = now()::date),
    'revenue_today', (SELECT COALESCE(sum(commission),0) FROM public.rides WHERE status='completed' AND completed_at::date = now()::date),
    'gross_today', (SELECT COALESCE(sum(final_fare),0) FROM public.rides WHERE status='completed' AND completed_at::date = now()::date),
    'active_drivers', (SELECT count(*) FROM public.drivers WHERE is_online AND status='approved'),
    'total_users', (SELECT count(*) FROM public.profiles),
    'pending_drivers', (SELECT count(*) FROM public.drivers WHERE status='pending')
  ) INTO res;
  RETURN res;
END; $$;

-- REALTIME
ALTER TABLE public.rides REPLICA IDENTITY FULL;
ALTER TABLE public.ride_messages REPLICA IDENTITY FULL;
ALTER TABLE public.driver_locations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
