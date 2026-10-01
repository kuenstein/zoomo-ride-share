CREATE OR REPLACE FUNCTION public.rider_cancel_blocked(_ride_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rides r JOIN public.driver_locations dl ON dl.driver_id = r.driver_id
    WHERE r.id = _ride_id AND r.status IN ('accepted','arriving')
      AND dl.updated_at > now() - interval '2 minutes'
      AND public.haversine_km(r.pickup_lat, r.pickup_lng, dl.lat, dl.lng) <= 1
  );
$$;

ALTER TABLE public.community_pins
  ADD COLUMN status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  ADD COLUMN reviewed_at timestamptz;
UPDATE public.community_pins SET status = 'approved', reviewed_at = now();

DROP POLICY IF EXISTS "read visible pins" ON public.community_pins;
CREATE POLICY "read visible pins" ON public.community_pins FOR SELECT TO authenticated
  USING ((status = 'approved' AND NOT is_hidden) OR created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "create own pins" ON public.community_pins;
CREATE POLICY "create own pins" ON public.community_pins FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND NOT is_hidden AND status = 'pending');

CREATE OR REPLACE FUNCTION public.guard_community_pin()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  NEW.name := trim(NEW.name);
  IF public.has_role(auth.uid(),'admin') OR auth.uid() IS NULL THEN
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN NEW.reviewed_at := now(); END IF;
    NEW.updated_at := now(); RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid(); NEW.is_hidden := false; NEW.created_at := now();
    NEW.status := 'pending'; NEW.reviewed_at := NULL;
    IF NOT public.in_service_area(NEW.lat, NEW.lng) THEN
      RAISE EXCEPTION 'Pins can only be saved inside the Zoomo service area';
    END IF;
    IF (SELECT count(*) FROM public.community_pins WHERE created_by = auth.uid() AND created_at > now() - interval '1 day') >= 10 THEN
      RAISE EXCEPTION 'Daily limit reached — you can save up to 10 pins per day';
    END IF;
  ELSE
    IF NEW.is_hidden IS DISTINCT FROM OLD.is_hidden OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at THEN
      RAISE EXCEPTION 'Only admins can change that';
    END IF;
    IF NEW.name IS DISTINCT FROM OLD.name OR NEW.lat IS DISTINCT FROM OLD.lat OR NEW.lng IS DISTINCT FROM OLD.lng
       OR NEW.category IS DISTINCT FROM OLD.category THEN
      NEW.status := 'pending'; NEW.reviewed_at := NULL;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

CREATE TABLE public.pin_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id uuid NOT NULL REFERENCES public.community_pins(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL DEFAULT auth.uid(),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 2 AND 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pin_id, reporter_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pin_reports TO authenticated;
GRANT ALL ON public.pin_reports TO service_role;
ALTER TABLE public.pin_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users report visible pins" ON public.pin_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND status = 'open'
    AND EXISTS (SELECT 1 FROM public.community_pins p WHERE p.id = pin_id AND p.status='approved' AND NOT p.is_hidden AND p.created_by <> auth.uid()));
CREATE POLICY "reporters see own reports" ON public.pin_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage reports" ON public.pin_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins delete reports" ON public.pin_reports FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));