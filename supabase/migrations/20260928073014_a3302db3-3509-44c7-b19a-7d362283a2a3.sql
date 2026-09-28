ALTER TABLE public.pricing_settings
  ADD COLUMN IF NOT EXISTS tricycle_surcharge numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS extra_passenger_fee numeric NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS baggage_fee numeric NOT NULL DEFAULT 15;

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS passengers integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS extra_baggage boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fare_offer numeric,
  ADD COLUMN IF NOT EXISTS extras_fee numeric NOT NULL DEFAULT 0;

-- Tricycle = motorcycle-style fare + surcharge (not on airport flat fares)
CREATE OR REPLACE FUNCTION public.calculate_fare(_type vehicle_type, _km numeric, _min numeric)
 RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p public.pricing_settings; f NUMERIC;
BEGIN
  SELECT * INTO p FROM public.pricing_settings WHERE id = 1;
  IF _type::text = 'tricycle' THEN
    f := p.base_fare_tricycle + p.per_km_tricycle * GREATEST(COALESCE(_km,0) - 1, 0);
    RETURN GREATEST(ROUND(f, 0), p.minimum_fare_tricycle) + ROUND(p.tricycle_surcharge, 0);
  ELSIF _type::text = 'bike' THEN
    f := p.base_fare_bike + p.per_km_bike * GREATEST(COALESCE(_km,0) - 1, 0);
    RETURN GREATEST(ROUND(f, 0), p.minimum_fare_bike);
  END IF;
  RAISE EXCEPTION 'Only Tricycle and Motorcycle rides are available';
END; $function$;

CREATE OR REPLACE FUNCTION public.enforce_ride_fare()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE est NUMERIC; promo JSONB; p public.pricing_settings; extras NUMERIC := 0;
BEGIN
  IF NEW.vehicle_type::text NOT IN ('tricycle','bike') THEN
    RAISE EXCEPTION 'Only Tricycle and Motorcycle rides are available';
  END IF;
  IF NOT public.in_service_area(NEW.pickup_lat, NEW.pickup_lng) OR NOT public.in_service_area(NEW.dropoff_lat, NEW.dropoff_lng) THEN
    RAISE EXCEPTION 'Zoomo is not yet available in this area';
  END IF;
  SELECT * INTO p FROM public.pricing_settings WHERE id = 1;
  IF NEW.vehicle_type::text = 'tricycle' THEN
    NEW.passengers := LEAST(GREATEST(COALESCE(NEW.passengers,1),1),4);
    NEW.extra_baggage := COALESCE(NEW.extra_baggage,false);
    extras := ROUND(p.extra_passenger_fee * (NEW.passengers - 1) + CASE WHEN NEW.extra_baggage THEN p.baggage_fee ELSE 0 END, 0);
  ELSE
    NEW.passengers := 1; NEW.extra_baggage := false;
  END IF;
  NEW.extras_fee := extras;
  est := public.ride_fare(NEW.vehicle_type, NEW.distance_km, NEW.duration_min,
    NEW.pickup_lat, NEW.pickup_lng, NEW.dropoff_lat, NEW.dropoff_lng) + extras;
  IF NEW.fare_offer IS NOT NULL AND ROUND(NEW.fare_offer,0) > est AND NEW.fare_offer <= est + 1000 THEN
    NEW.fare_offer := ROUND(NEW.fare_offer, 0);
    est := NEW.fare_offer;
  ELSE
    NEW.fare_offer := NULL;
  END IF;
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

-- Rider tips after a completed trip
CREATE OR REPLACE FUNCTION public.add_tip(_ride_id uuid, _amount numeric)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r public.rides; bal NUMERIC; amt NUMERIC := ROUND(COALESCE(_amount,0), 0);
BEGIN
  IF amt < 1 OR amt > 1000 THEN RETURN jsonb_build_object('success',false,'message','Tip must be between ₱1 and ₱1,000'); END IF;
  SELECT * INTO r FROM public.rides WHERE id = _ride_id FOR UPDATE;
  IF NOT FOUND OR r.rider_id <> auth.uid() THEN RETURN jsonb_build_object('success',false,'message','Ride not found'); END IF;
  IF r.status <> 'completed' OR r.driver_id IS NULL THEN RETURN jsonb_build_object('success',false,'message','You can tip after the trip is completed'); END IF;
  IF r.tip > 0 THEN RETURN jsonb_build_object('success',false,'message','You already tipped for this trip'); END IF;
  IF r.payment_method = 'wallet' THEN
    SELECT balance INTO bal FROM public.wallets WHERE user_id = r.rider_id FOR UPDATE;
    IF COALESCE(bal,0) < amt THEN RETURN jsonb_build_object('success',false,'message','Wallet balance too low for this tip'); END IF;
    UPDATE public.wallets SET balance = balance - amt, updated_at = now() WHERE user_id = r.rider_id;
    INSERT INTO public.wallet_transactions (user_id, amount, kind, description, ride_id) VALUES (r.rider_id, -amt, 'tip', 'Tip for driver', r.id);
    INSERT INTO public.wallets (user_id, balance) VALUES (r.driver_id, amt)
      ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + amt, updated_at = now();
    INSERT INTO public.wallet_transactions (user_id, amount, kind, description, ride_id) VALUES (r.driver_id, amt, 'tip', 'Tip from rider', r.id);
  END IF;
  UPDATE public.rides SET tip = amt, driver_earnings = driver_earnings + amt WHERE id = _ride_id;
  INSERT INTO public.notifications (user_id, title, body) VALUES (r.driver_id, 'You got a tip!',
    '₱' || amt || CASE WHEN r.payment_method = 'wallet' THEN ' added to your wallet.' ELSE ' — collect it in cash.' END);
  RETURN jsonb_build_object('success',true);
END; $function$;

-- Stop riders editing money fields on their rides directly
CREATE OR REPLACE FUNCTION public.protect_ride_money()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('role', true) = 'authenticated' AND pg_trigger_depth() = 1 THEN
    NEW.tip := OLD.tip; NEW.fare_estimate := OLD.fare_estimate; NEW.discount := OLD.discount;
    NEW.final_fare := OLD.final_fare; NEW.commission := OLD.commission; NEW.driver_earnings := OLD.driver_earnings;
    NEW.fare_offer := OLD.fare_offer; NEW.extras_fee := OLD.extras_fee;
    NEW.passengers := OLD.passengers; NEW.extra_baggage := OLD.extra_baggage;
  END IF;
  RETURN NEW;
END; $function$;
DROP TRIGGER IF EXISTS rides_protect_money ON public.rides;
CREATE TRIGGER rides_protect_money BEFORE UPDATE ON public.rides FOR EACH ROW EXECUTE FUNCTION public.protect_ride_money();

-- Rider like/dislike feedback about drivers, reviewed by admins
CREATE TABLE public.driver_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  rider_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  sentiment text NOT NULL CHECK (sentiment IN ('like','dislike')),
  comment text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ride_id)
);
GRANT SELECT, INSERT, UPDATE ON public.driver_feedback TO authenticated;
GRANT ALL ON public.driver_feedback TO service_role;
ALTER TABLE public.driver_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Riders send feedback on their completed rides" ON public.driver_feedback FOR INSERT TO authenticated
  WITH CHECK (rider_id = auth.uid() AND status = 'new' AND EXISTS (
    SELECT 1 FROM public.rides r WHERE r.id = ride_id AND r.rider_id = auth.uid()
      AND r.driver_id = driver_feedback.driver_id AND r.status = 'completed'));
CREATE POLICY "Riders see own feedback, admins see all" ON public.driver_feedback FOR SELECT TO authenticated
  USING (rider_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update feedback" ON public.driver_feedback FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER driver_feedback_updated BEFORE UPDATE ON public.driver_feedback FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();