CREATE OR REPLACE FUNCTION public.calculate_fare(_type vehicle_type, _km numeric, _min numeric)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE p public.pricing_settings; f NUMERIC;
BEGIN
  -- First km covered by the base fare; each km after the first adds per_km. _min kept for compatibility, ignored.
  SELECT * INTO p FROM public.pricing_settings WHERE id = 1;
  IF _type::text = 'tricycle' THEN
    f := p.base_fare_tricycle + p.per_km_tricycle * GREATEST(COALESCE(_km,0) - 1, 0);
    RETURN GREATEST(ROUND(f, 0), p.minimum_fare_tricycle);
  ELSIF _type::text = 'bike' THEN
    f := p.base_fare_bike + p.per_km_bike * GREATEST(COALESCE(_km,0) - 1, 0);
    RETURN GREATEST(ROUND(f, 0), p.minimum_fare_bike);
  END IF;
  RAISE EXCEPTION 'Only Tricycle and Motorcycle rides are available';
END; $function$;

UPDATE public.pricing_settings SET
  base_fare_tricycle = 20, per_km_tricycle = 15, minimum_fare_tricycle = 20,
  base_fare_bike = 20, per_km_bike = 15, minimum_fare_bike = 20
WHERE id = 1;