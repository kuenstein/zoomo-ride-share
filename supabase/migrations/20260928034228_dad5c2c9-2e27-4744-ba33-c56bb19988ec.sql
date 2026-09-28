ALTER TYPE public.vehicle_type ADD VALUE IF NOT EXISTS 'tricycle';

ALTER TABLE public.pricing_settings
  ADD COLUMN IF NOT EXISTS multiplier_tricycle numeric NOT NULL DEFAULT 0.80,
  ADD COLUMN IF NOT EXISTS airport_flat_fare numeric NOT NULL DEFAULT 250,
  ADD COLUMN IF NOT EXISTS airport_lat double precision NOT NULL DEFAULT 9.3337,
  ADD COLUMN IF NOT EXISTS airport_lng double precision NOT NULL DEFAULT 123.3002,
  ADD COLUMN IF NOT EXISTS airport_radius_km numeric NOT NULL DEFAULT 1.5;
ALTER TABLE public.pricing_settings
  ALTER COLUMN base_fare SET DEFAULT 40, ALTER COLUMN per_km SET DEFAULT 12,
  ALTER COLUMN per_minute SET DEFAULT 1.5, ALTER COLUMN minimum_fare SET DEFAULT 50,
  ALTER COLUMN commission_percent SET DEFAULT 15, ALTER COLUMN multiplier_comfort SET DEFAULT 1.3,
  ALTER COLUMN multiplier_xl SET DEFAULT 1.6, ALTER COLUMN multiplier_bike SET DEFAULT 0.8,
  ALTER COLUMN currency SET DEFAULT 'PHP';

CREATE TABLE public.service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  center_lat double precision NOT NULL,
  center_lng double precision NOT NULL,
  radius_km numeric NOT NULL DEFAULT 5,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.service_areas TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.service_areas TO authenticated;
GRANT ALL ON public.service_areas TO service_role;
ALTER TABLE public.service_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service areas public read" ON public.service_areas FOR SELECT USING (true);
CREATE POLICY "service areas admin write" ON public.service_areas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.service_areas (name, center_lat, center_lng, radius_km) VALUES
 ('Dumaguete City', 9.3068, 123.3054, 5),
 ('Bacong', 9.2466, 123.2944, 4),
 ('Sibulan', 9.3547, 123.2856, 5),
 ('Valencia', 9.2826, 123.2447, 5);

CREATE OR REPLACE FUNCTION public.in_service_area(_lat double precision, _lng double precision)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.service_areas WHERE active
    AND public.haversine_km(_lat,_lng,center_lat,center_lng) <= radius_km);
$$;

CREATE OR REPLACE FUNCTION public.ride_fare(_type vehicle_type, _km numeric, _min numeric,
  _plat double precision, _plng double precision, _dlat double precision, _dlng double precision)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.pricing_settings; m NUMERIC;
BEGIN
  SELECT * INTO p FROM public.pricing_settings WHERE id = 1;
  IF public.haversine_km(_plat,_plng,p.airport_lat,p.airport_lng) <= p.airport_radius_km
     OR public.haversine_km(_dlat,_dlng,p.airport_lat,p.airport_lng) <= p.airport_radius_km THEN
    m := CASE _type::text WHEN 'economy' THEN p.multiplier_economy WHEN 'comfort' THEN p.multiplier_comfort
         WHEN 'xl' THEN p.multiplier_xl WHEN 'tricycle' THEN p.multiplier_tricycle ELSE p.multiplier_bike END;
    RETURN ROUND(p.airport_flat_fare * m, 0);
  END IF;
  RETURN public.calculate_fare(_type, _km, _min);
END; $$;

CREATE OR REPLACE FUNCTION public.calculate_fare(_type vehicle_type, _km numeric, _min numeric)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.pricing_settings; m NUMERIC; f NUMERIC;
BEGIN
  SELECT * INTO p FROM public.pricing_settings WHERE id = 1;
  m := CASE _type::text WHEN 'economy' THEN p.multiplier_economy WHEN 'comfort' THEN p.multiplier_comfort
       WHEN 'xl' THEN p.multiplier_xl WHEN 'tricycle' THEN p.multiplier_tricycle ELSE p.multiplier_bike END;
  f := (p.base_fare + p.per_km * COALESCE(_km,0) + p.per_minute * COALESCE(_min,0)) * m;
  RETURN ROUND(GREATEST(f, p.minimum_fare * m), 0);
END; $$;

CREATE OR REPLACE FUNCTION public.enforce_ride_fare()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE est NUMERIC; promo JSONB;
BEGIN
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
END; $$;

CREATE OR REPLACE FUNCTION public.wallet_topup(_amount numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE newbal NUMERIC;
BEGIN
  IF _amount IS NULL OR _amount < 50 OR _amount > 10000 THEN RETURN jsonb_build_object('success', false,'message','Amount must be between ₱50 and ₱10,000'); END IF;
  INSERT INTO public.wallets (user_id, balance) VALUES (auth.uid(), _amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + _amount, updated_at = now()
  RETURNING balance INTO newbal;
  INSERT INTO public.wallet_transactions (user_id, amount, kind, description) VALUES (auth.uid(), _amount,'topup','Wallet top-up');
  RETURN jsonb_build_object('success', true, 'balance', newbal);
END; $$;

REVOKE EXECUTE ON FUNCTION public.in_service_area(double precision,double precision) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ride_fare(vehicle_type,numeric,numeric,double precision,double precision,double precision,double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.in_service_area(double precision,double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ride_fare(vehicle_type,numeric,numeric,double precision,double precision,double precision,double precision) TO authenticated;