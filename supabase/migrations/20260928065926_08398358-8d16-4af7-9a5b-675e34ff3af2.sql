ALTER TABLE public.pricing_settings
  ADD COLUMN IF NOT EXISTS base_fare_tricycle numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS per_km_tricycle numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS minimum_fare_tricycle numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS airport_fare_tricycle numeric NOT NULL DEFAULT 150,
  ADD COLUMN IF NOT EXISTS base_fare_bike numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS per_km_bike numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS minimum_fare_bike numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS airport_fare_bike numeric NOT NULL DEFAULT 150;

CREATE OR REPLACE FUNCTION public.calculate_fare(_type vehicle_type, _km numeric, _min numeric)
 RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p public.pricing_settings; f NUMERIC;
BEGIN
  -- Per-type distance pricing. _min kept for compatibility, ignored.
  SELECT * INTO p FROM public.pricing_settings WHERE id = 1;
  IF _type::text = 'tricycle' THEN
    f := p.base_fare_tricycle + p.per_km_tricycle * COALESCE(_km,0);
    RETURN GREATEST(ROUND(f, 0), p.minimum_fare_tricycle);
  ELSIF _type::text = 'bike' THEN
    f := p.base_fare_bike + p.per_km_bike * COALESCE(_km,0);
    RETURN GREATEST(ROUND(f, 0), p.minimum_fare_bike);
  END IF;
  RAISE EXCEPTION 'Only Tricycle and Motorcycle rides are available';
END; $function$;

CREATE OR REPLACE FUNCTION public.ride_fare(_type vehicle_type, _km numeric, _min numeric, _plat double precision, _plng double precision, _dlat double precision, _dlng double precision)
 RETURNS numeric LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $function$
DECLARE p public.pricing_settings;
BEGIN
  SELECT * INTO p FROM public.pricing_settings WHERE id = 1;
  IF public.haversine_km(_plat,_plng,p.airport_lat,p.airport_lng) <= p.airport_radius_km
     OR public.haversine_km(_dlat,_dlng,p.airport_lat,p.airport_lng) <= p.airport_radius_km THEN
    IF _type::text = 'tricycle' THEN RETURN ROUND(p.airport_fare_tricycle, 0);
    ELSIF _type::text = 'bike' THEN RETURN ROUND(p.airport_fare_bike, 0);
    END IF;
    RAISE EXCEPTION 'Only Tricycle and Motorcycle rides are available';
  END IF;
  RETURN public.calculate_fare(_type, _km, _min);
END; $function$;

CREATE OR REPLACE FUNCTION public.credit_paid_checkout(_session_id text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE c public.payment_checkouts;
BEGIN
  SELECT * INTO c FROM public.payment_checkouts WHERE provider_session_id = _session_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'message','unknown session'); END IF;
  IF c.status = 'paid' THEN RETURN jsonb_build_object('success',true,'already',true); END IF;
  UPDATE public.payment_checkouts SET status='paid', paid_at=now() WHERE id=c.id;
  INSERT INTO public.wallets(user_id,balance) VALUES (c.user_id,0) ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.wallets SET balance = balance + c.amount, updated_at=now() WHERE user_id=c.user_id;
  INSERT INTO public.wallet_transactions(user_id,amount,kind,description)
    VALUES (c.user_id, c.amount, 'topup', 'Top-up via ' || CASE c.method WHEN 'gcash' THEN 'GCash' WHEN 'maya' THEN 'Maya' ELSE 'QR Ph' END);
  RETURN jsonb_build_object('success',true);
END $function$;