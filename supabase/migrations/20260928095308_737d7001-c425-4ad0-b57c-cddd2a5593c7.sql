
-- 1. QR Ph
ALTER TABLE public.payment_checkouts DROP CONSTRAINT IF EXISTS payment_checkouts_method_check;
ALTER TABLE public.payment_checkouts ADD CONSTRAINT payment_checkouts_method_check CHECK (method IN ('gcash','maya','qrph'));

-- 2. Signup role
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE r public.app_role;
BEGIN
  r := CASE WHEN lower(coalesce(NEW.raw_user_meta_data->>'role','')) = 'driver' THEN 'driver'::public.app_role
            ELSE 'rider'::public.app_role END;
  INSERT INTO public.profiles (id, full_name, phone, avatar_url)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'phone', NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.wallets (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, r) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

-- 5. setting
ALTER TABLE public.pricing_settings ADD COLUMN IF NOT EXISTS max_driver_debt numeric NOT NULL DEFAULT 500;

CREATE OR REPLACE FUNCTION public.driver_debt_blocked(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT balance FROM public.wallets WHERE user_id=_user_id),0)
       < -COALESCE((SELECT max_driver_debt FROM public.pricing_settings WHERE id=1),500);
$$;
REVOKE EXECUTE ON FUNCTION public.driver_debt_blocked(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_debt_blocked(uuid) TO authenticated;

-- block going online while over debt limit
CREATE OR REPLACE FUNCTION public.block_indebted_online()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_online AND NOT COALESCE(OLD.is_online,false) AND public.driver_debt_blocked(NEW.user_id) THEN
    RAISE EXCEPTION 'You owe Zoomo more than the allowed limit. Please settle your balance to go online.';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS drivers_block_debt ON public.drivers;
CREATE TRIGGER drivers_block_debt BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.block_indebted_online();

-- accept_ride: debt check + stale requests
CREATE OR REPLACE FUNCTION public.accept_ride(_ride_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE updated INT; vt vehicle_type;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.drivers WHERE user_id = auth.uid() AND status='approved') THEN
    RETURN jsonb_build_object('success', false, 'message','Driver not approved');
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
END; $$;

-- 3. Ride update protection (invoker: current_user is 'authenticated' only for direct client updates)
CREATE OR REPLACE FUNCTION public.protect_ride_update()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF current_user <> 'authenticated' THEN RETURN NEW; END IF;  -- service role / security definer functions
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
     OR NEW.passengers IS DISTINCT FROM OLD.passengers OR NEW.extra_baggage IS DISTINCT FROM OLD.extra_baggage THEN
    RAISE EXCEPTION 'This trip detail cannot be changed';
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    IF NEW.started_at IS DISTINCT FROM OLD.started_at OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
       OR NEW.cancel_reason IS DISTINCT FROM OLD.cancel_reason THEN
      RAISE EXCEPTION 'This trip detail cannot be changed';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'completed' THEN RAISE EXCEPTION 'Trips can only be completed by the driver''s Complete button'; END IF;
  IF NEW.status = 'accepted' THEN RAISE EXCEPTION 'Rides can only be accepted from the request screen'; END IF;

  IF uid = OLD.rider_id AND NEW.status = 'cancelled' AND OLD.status IN ('requested','accepted','arriving') THEN
    NEW.cancelled_at := now(); NEW.started_at := OLD.started_at;
    NEW.cancel_reason := left(COALESCE(NULLIF(trim(NEW.cancel_reason),''),'Cancelled by rider'),300);
    RETURN NEW;
  END IF;
  IF uid = OLD.driver_id THEN
    IF OLD.status = 'accepted' AND NEW.status = 'arriving' THEN
      NEW.started_at := OLD.started_at; NEW.cancelled_at := OLD.cancelled_at; NEW.cancel_reason := OLD.cancel_reason; RETURN NEW;
    ELSIF OLD.status = 'arriving' AND NEW.status = 'in_progress' THEN
      NEW.started_at := now(); NEW.cancelled_at := OLD.cancelled_at; NEW.cancel_reason := OLD.cancel_reason; RETURN NEW;
    ELSIF OLD.status IN ('accepted','arriving') AND NEW.status = 'cancelled' THEN
      NEW.cancelled_at := now(); NEW.started_at := OLD.started_at;
      NEW.cancel_reason := left(COALESCE(NULLIF(trim(NEW.cancel_reason),''),'Cancelled by driver'),300);
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'Trip status can''t change from % to %', OLD.status, NEW.status;
END; $$;
DROP TRIGGER IF EXISTS rides_protect_money ON public.rides;
DROP TRIGGER IF EXISTS rides_protect_update ON public.rides;
CREATE TRIGGER rides_protect_update BEFORE UPDATE ON public.rides FOR EACH ROW EXECUTE FUNCTION public.protect_ride_update();

CREATE OR REPLACE FUNCTION public.rider_cancel_ride(_ride_id uuid, _reason text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE n int;
BEGIN
  UPDATE public.rides SET status='cancelled', cancelled_at=now(),
    cancel_reason=left(COALESCE(NULLIF(trim(_reason),''),'Cancelled by rider'),300)
  WHERE id=_ride_id AND rider_id=auth.uid() AND status IN ('requested','accepted','arriving');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n=0 THEN RETURN jsonb_build_object('success',false,'message','This ride can no longer be cancelled'); END IF;
  INSERT INTO public.notifications (user_id,title,body)
    SELECT driver_id,'Trip cancelled','The rider cancelled this trip.' FROM public.rides WHERE id=_ride_id AND driver_id IS NOT NULL;
  RETURN jsonb_build_object('success',true);
END; $$;

CREATE OR REPLACE FUNCTION public.driver_set_ride_status(_ride_id uuid, _status ride_status, _reason text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE r public.rides;
BEGIN
  SELECT * INTO r FROM public.rides WHERE id=_ride_id FOR UPDATE;
  IF NOT FOUND OR r.driver_id IS DISTINCT FROM auth.uid() THEN RETURN jsonb_build_object('success',false,'message','Not your ride'); END IF;
  IF r.status='accepted' AND _status='arriving' THEN
    UPDATE public.rides SET status='arriving' WHERE id=_ride_id;
  ELSIF r.status='arriving' AND _status='in_progress' THEN
    UPDATE public.rides SET status='in_progress', started_at=now() WHERE id=_ride_id;
  ELSIF r.status IN ('accepted','arriving') AND _status='cancelled' THEN
    UPDATE public.rides SET status='cancelled', cancelled_at=now(),
      cancel_reason=left(COALESCE(NULLIF(trim(_reason),''),'Cancelled by driver'),300) WHERE id=_ride_id;
    INSERT INTO public.notifications (user_id,title,body) VALUES (r.rider_id,'Trip cancelled','Your driver cancelled. Please request again.');
  ELSE
    RETURN jsonb_build_object('success',false,'message','Trip status can''t change from '||r.status||' to '||_status);
  END IF;
  RETURN jsonb_build_object('success',true);
END; $$;

-- 5. complete_ride with in_progress requirement + cash accounting
CREATE OR REPLACE FUNCTION public.complete_ride(_ride_id uuid, _tip numeric DEFAULT 0)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE r public.rides; p public.pricing_settings; gross NUMERIC; net NUMERIC; comm NUMERIC; bal NUMERIC; t NUMERIC := GREATEST(COALESCE(_tip,0),0);
BEGIN
  SELECT * INTO r FROM public.rides WHERE id = _ride_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false,'message','Ride not found'); END IF;
  IF r.driver_id IS DISTINCT FROM auth.uid() THEN RETURN jsonb_build_object('success', false,'message','Not your ride'); END IF;
  IF r.status = 'completed' THEN RETURN jsonb_build_object('success', true,'message','Already completed'); END IF;
  IF r.status <> 'in_progress' THEN RETURN jsonb_build_object('success', false,'message','Start the trip before completing it'); END IF;
  SELECT * INTO p FROM public.pricing_settings WHERE id = 1;
  gross := GREATEST(r.fare_estimate - r.discount, 0) + t;
  comm := ROUND(gross * p.commission_percent / 100.0, 2);
  net := ROUND(gross - comm, 2);

  IF r.payment_method = 'wallet' THEN
    SELECT balance INTO bal FROM public.wallets WHERE user_id = r.rider_id FOR UPDATE;
    IF COALESCE(bal,0) < gross THEN RETURN jsonb_build_object('success', false,'message','Rider wallet balance too low'); END IF;
    UPDATE public.wallets SET balance = balance - gross, updated_at = now() WHERE user_id = r.rider_id;
    INSERT INTO public.wallet_transactions (user_id, amount, kind, description, ride_id)
    VALUES (r.rider_id, -gross, 'ride_payment', 'Trip payment', r.id);
    INSERT INTO public.wallets (user_id, balance) VALUES (r.driver_id, net)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + net, updated_at = now();
    INSERT INTO public.wallet_transactions (user_id, amount, kind, description, ride_id)
    VALUES (r.driver_id, net, 'earning', 'Trip earnings', r.id);
  ELSE
    -- cash (or card placeholder): driver already holds the cash; platform collects commission from the driver wallet
    IF comm > 0 THEN
      INSERT INTO public.wallets (user_id, balance) VALUES (r.driver_id, -comm)
      ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance - comm, updated_at = now();
      INSERT INTO public.wallet_transactions (user_id, amount, kind, description, ride_id)
      VALUES (r.driver_id, -comm, 'commission', 'Zoomo commission (cash trip)', r.id);
    END IF;
  END IF;

  UPDATE public.rides SET status='completed', completed_at = now(), final_fare = gross,
    tip = t, commission = comm, driver_earnings = net WHERE id = _ride_id;
  UPDATE public.drivers SET total_trips = total_trips + 1 WHERE user_id = r.driver_id;
  IF r.promo_code IS NOT NULL THEN UPDATE public.promo_codes SET times_used = times_used + 1 WHERE upper(code) = upper(r.promo_code); END IF;
  INSERT INTO public.notifications (user_id, title, body) VALUES (r.rider_id,'Trip completed','Thanks for riding with Zoomo.');
  RETURN jsonb_build_object('success', true, 'fare', gross, 'earnings', net, 'cash', r.payment_method <> 'wallet', 'commission', comm);
END; $$;

-- 4. Distance validation in enforce_ride_fare
CREATE OR REPLACE FUNCTION public.enforce_ride_fare()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE est NUMERIC; promo JSONB; p public.pricing_settings; extras NUMERIC := 0; straight NUMERIC;
BEGIN
  IF NEW.vehicle_type::text NOT IN ('tricycle','bike') THEN
    RAISE EXCEPTION 'Only Tricycle and Motorcycle rides are available';
  END IF;
  IF NOT public.in_service_area(NEW.pickup_lat, NEW.pickup_lng) OR NOT public.in_service_area(NEW.dropoff_lat, NEW.dropoff_lng) THEN
    RAISE EXCEPTION 'Zoomo is not yet available in this area';
  END IF;
  IF NEW.duration_min IS NULL OR NEW.duration_min < 0 THEN
    RAISE EXCEPTION 'Invalid trip duration';
  END IF;
  straight := public.haversine_km(NEW.pickup_lat, NEW.pickup_lng, NEW.dropoff_lat, NEW.dropoff_lng)::numeric;
  IF NEW.distance_km IS NULL OR NEW.distance_km < straight * 0.9 OR NEW.distance_km > straight * 3 + 2 THEN
    NEW.distance_km := ROUND(straight * 1.2, 2);
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
  NEW.tip := 0; NEW.commission := 0; NEW.driver_earnings := 0; NEW.final_fare := NULL;
  NEW.requested_at := now(); NEW.accepted_at := NULL; NEW.started_at := NULL; NEW.completed_at := NULL; NEW.cancelled_at := NULL;
  RETURN NEW;
END; $$;

-- admin settlement
CREATE OR REPLACE FUNCTION public.admin_wallet_adjust(_user_id uuid, _amount numeric, _note text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE amt numeric := ROUND(COALESCE(_amount,0),2); nb numeric;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF amt = 0 OR abs(amt) > 100000 THEN RETURN jsonb_build_object('success',false,'message','Enter a non-zero amount up to ₱100,000'); END IF;
  INSERT INTO public.wallets (user_id, balance) VALUES (_user_id, amt)
  ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + amt, updated_at = now()
  RETURNING balance INTO nb;
  INSERT INTO public.wallet_transactions (user_id, amount, kind, description)
  VALUES (_user_id, amt, 'settlement', left(COALESCE(NULLIF(trim(_note),''),'Settlement recorded by admin'),200));
  RETURN jsonb_build_object('success',true,'balance',nb);
END; $$;

-- 6. payouts
CREATE TABLE public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  method text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','rejected')),
  notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payout_requests TO authenticated;
GRANT ALL ON public.payout_requests TO service_role;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drivers read own payouts, admins read all" ON public.payout_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER payout_requests_updated BEFORE UPDATE ON public.payout_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.request_payout(_amount numeric, _method text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE amt numeric := ROUND(COALESCE(_amount,0),2); bal numeric; m text := left(trim(COALESCE(_method,'')),200);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.drivers WHERE user_id=auth.uid()) THEN RETURN jsonb_build_object('success',false,'message','Only drivers can request payouts'); END IF;
  IF length(m) < 5 THEN RETURN jsonb_build_object('success',false,'message','Enter your GCash number or bank details'); END IF;
  IF amt < 100 THEN RETURN jsonb_build_object('success',false,'message','Minimum payout is ₱100'); END IF;
  SELECT balance INTO bal FROM public.wallets WHERE user_id=auth.uid() FOR UPDATE;
  IF COALESCE(bal,0) < amt THEN RETURN jsonb_build_object('success',false,'message','Amount is more than your wallet balance'); END IF;
  UPDATE public.wallets SET balance = balance - amt, updated_at=now() WHERE user_id=auth.uid();
  INSERT INTO public.wallet_transactions (user_id, amount, kind, description) VALUES (auth.uid(), -amt, 'payout_hold', 'Payout requested');
  INSERT INTO public.payout_requests (user_id, amount, method) VALUES (auth.uid(), amt, m);
  RETURN jsonb_build_object('success',true);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_resolve_payout(_id uuid, _status text, _notes text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE pr public.payout_requests;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _status NOT IN ('paid','rejected') THEN RETURN jsonb_build_object('success',false,'message','Invalid status'); END IF;
  SELECT * INTO pr FROM public.payout_requests WHERE id=_id FOR UPDATE;
  IF NOT FOUND OR pr.status <> 'pending' THEN RETURN jsonb_build_object('success',false,'message','Request is no longer pending'); END IF;
  UPDATE public.payout_requests SET status=_status, notes=left(_notes,500), resolved_at=now() WHERE id=_id;
  IF _status='rejected' THEN
    UPDATE public.wallets SET balance = balance + pr.amount, updated_at=now() WHERE user_id=pr.user_id;
    INSERT INTO public.wallet_transactions (user_id, amount, kind, description) VALUES (pr.user_id, pr.amount, 'payout_release', 'Payout rejected — amount returned');
    INSERT INTO public.notifications (user_id,title,body) VALUES (pr.user_id,'Payout rejected', COALESCE(NULLIF(_notes,''),'The amount was returned to your wallet.'));
  ELSE
    INSERT INTO public.notifications (user_id,title,body) VALUES (pr.user_id,'Payout sent','₱'||pr.amount||' was sent to '||pr.method||'.');
  END IF;
  RETURN jsonb_build_object('success',true);
END; $$;

-- execute grants
REVOKE EXECUTE ON FUNCTION public.rider_cancel_ride(uuid,text), public.driver_set_ride_status(uuid,ride_status,text),
  public.admin_wallet_adjust(uuid,numeric,text), public.request_payout(numeric,text), public.admin_resolve_payout(uuid,text,text),
  public.complete_ride(uuid,numeric), public.accept_ride(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rider_cancel_ride(uuid,text), public.driver_set_ride_status(uuid,ride_status,text),
  public.admin_wallet_adjust(uuid,numeric,text), public.request_payout(numeric,text), public.admin_resolve_payout(uuid,text,text),
  public.complete_ride(uuid,numeric), public.accept_ride(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_ride_update(), public.block_indebted_online(), public.handle_new_user() FROM PUBLIC, anon, authenticated;
