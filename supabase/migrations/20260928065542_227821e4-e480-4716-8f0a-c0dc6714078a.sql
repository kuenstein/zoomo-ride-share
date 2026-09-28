CREATE OR REPLACE FUNCTION public.calculate_fare(_type vehicle_type, _km numeric, _min numeric)
 RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p public.pricing_settings; m NUMERIC; f NUMERIC;
BEGIN
  -- Distance-only pricing: _min is accepted for compatibility but ignored.
  SELECT * INTO p FROM public.pricing_settings WHERE id = 1;
  m := CASE _type::text WHEN 'tricycle' THEN p.multiplier_tricycle WHEN 'bike' THEN p.multiplier_bike
       WHEN 'economy' THEN p.multiplier_economy WHEN 'comfort' THEN p.multiplier_comfort
       WHEN 'xl' THEN p.multiplier_xl ELSE p.multiplier_bike END;
  f := (p.base_fare + p.per_km * COALESCE(_km,0)) * m;
  RETURN ROUND(GREATEST(f, p.minimum_fare * m), 0);
END; $function$;