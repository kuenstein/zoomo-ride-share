-- Regression tests for the privacy RLS policies on profiles, drivers, vehicles,
-- driver_locations and pricing_settings (public read / admin-only write).
-- Runs entirely inside a transaction and ROLLS BACK: no data is left behind.
-- Any failed check raises an exception naming the broken rule.
BEGIN;

-- ---------- fixtures (as table owner, triggers off) ----------
SET LOCAL session_replication_role = replica;

INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-0000-0000-00000000000a','rls-rider@test.local','authenticated','authenticated'),
  ('00000000-0000-0000-0000-00000000000b','rls-past-rider@test.local','authenticated','authenticated'),
  ('00000000-0000-0000-0000-00000000000d','rls-driver@test.local','authenticated','authenticated'),
  ('00000000-0000-0000-0000-00000000000e','rls-stranger@test.local','authenticated','authenticated'),
  ('00000000-0000-0000-0000-00000000000f','rls-admin@test.local','authenticated','authenticated');

INSERT INTO public.profiles (id, full_name, phone) VALUES
  ('00000000-0000-0000-0000-00000000000a','Rider A','09170000001'),
  ('00000000-0000-0000-0000-00000000000b','Past Rider B','09170000002'),
  ('00000000-0000-0000-0000-00000000000d','Driver D','09170000003'),
  ('00000000-0000-0000-0000-00000000000e','Stranger S','09170000004'),
  ('00000000-0000-0000-0000-00000000000f','Admin M','09170000005');

INSERT INTO public.user_roles (user_id, role) VALUES
  ('00000000-0000-0000-0000-00000000000f','admin');

INSERT INTO public.drivers (id, user_id, license_number, status) VALUES
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-00000000000d','LTO-TEST','approved');
INSERT INTO public.vehicles (driver_id, type, make, model, color, plate) VALUES
  ('00000000-0000-0000-0000-0000000000d1','tricycle','Honda','TMX','Red','TEST-123');
INSERT INTO public.driver_locations (driver_id, lat, lng, is_online) VALUES
  ('00000000-0000-0000-0000-00000000000d', 9.3068, 123.3054, true);

-- A: active trip with D.  B: finished trip with D.
INSERT INTO public.rides (rider_id, driver_id, status, vehicle_type, pickup_lat, pickup_lng, pickup_address, dropoff_lat, dropoff_lng, dropoff_address) VALUES
  ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000d','in_progress','tricycle',9.30,123.30,'A',9.31,123.31,'B'),
  ('00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-00000000000d','completed','tricycle',9.30,123.30,'A',9.31,123.31,'B');

SET LOCAL session_replication_role = origin;

-- ---------- helpers ----------
CREATE FUNCTION pg_temp.expect(label text, actual bigint, expected bigint) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'RLS TEST FAILED: % (expected %, got %)', label, expected, actual;
  END IF; END $$;
GRANT EXECUTE ON FUNCTION pg_temp.expect(text,bigint,bigint) TO authenticated, anon;

CREATE FUNCTION pg_temp.act_as(uid text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role','authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', uid, true);
END $$;

-- ================= Stranger S: sees only self, can't modify others =================
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000000e');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect('stranger sees own profile',
  (SELECT count(*) FROM public.profiles WHERE id='00000000-0000-0000-0000-00000000000e'), 1);
SELECT pg_temp.expect('stranger cannot read other profiles',
  (SELECT count(*) FROM public.profiles WHERE id<>'00000000-0000-0000-0000-00000000000e'), 0);
SELECT pg_temp.expect('stranger cannot read drivers', (SELECT count(*) FROM public.drivers), 0);
SELECT pg_temp.expect('stranger cannot read vehicles', (SELECT count(*) FROM public.vehicles), 0);
SELECT pg_temp.expect('stranger cannot read driver locations', (SELECT count(*) FROM public.driver_locations), 0);
WITH u AS (UPDATE public.profiles SET full_name='hacked' WHERE id='00000000-0000-0000-0000-00000000000d' RETURNING 1)
SELECT pg_temp.expect('stranger cannot edit another profile', (SELECT count(*) FROM u), 0);
WITH u AS (UPDATE public.vehicles SET plate='HACK' RETURNING 1)
SELECT pg_temp.expect('stranger cannot edit vehicles', (SELECT count(*) FROM u), 0);
WITH u AS (UPDATE public.driver_locations SET lat=0 RETURNING 1)
SELECT pg_temp.expect('stranger cannot move driver location', (SELECT count(*) FROM u), 0);
WITH u AS (DELETE FROM public.drivers RETURNING 1)
SELECT pg_temp.expect('stranger cannot delete drivers', (SELECT count(*) FROM u), 0);
WITH u AS (UPDATE public.pricing_settings SET commission_percent = 99 RETURNING 1)
SELECT pg_temp.expect('non-admin cannot change pricing', (SELECT count(*) FROM u), 0);
SELECT pg_temp.expect('signed-in user can read pricing', (SELECT least(count(*),1) FROM public.pricing_settings), 1);
RESET ROLE;

-- ================= Rider A (active trip with D) =================
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect('rider sees own + driver profile', (SELECT count(*) FROM public.profiles), 2);
SELECT pg_temp.expect('rider sees assigned driver record', (SELECT count(*) FROM public.drivers), 1);
SELECT pg_temp.expect('rider sees assigned vehicle', (SELECT count(*) FROM public.vehicles), 1);
SELECT pg_temp.expect('rider on active trip sees driver location', (SELECT count(*) FROM public.driver_locations), 1);
WITH u AS (UPDATE public.drivers SET license_number='X' RETURNING 1)
SELECT pg_temp.expect('rider cannot edit driver record', (SELECT count(*) FROM u), 0);
WITH u AS (UPDATE public.profiles SET full_name='Rider A2' WHERE id='00000000-0000-0000-0000-00000000000a' RETURNING 1)
SELECT pg_temp.expect('rider can edit own profile', (SELECT count(*) FROM u), 1);
RESET ROLE;

-- ================= Past rider B (finished trip with D) =================
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect('past rider still sees driver profile',
  (SELECT count(*) FROM public.profiles WHERE id='00000000-0000-0000-0000-00000000000d'), 1);
SELECT pg_temp.expect('past rider cannot see other riders',
  (SELECT count(*) FROM public.profiles WHERE id='00000000-0000-0000-0000-00000000000a'), 0);
SELECT pg_temp.expect('past rider cannot track driver location', (SELECT count(*) FROM public.driver_locations), 0);
RESET ROLE;

-- ================= Driver D =================
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect('driver sees self + both riders', (SELECT count(*) FROM public.profiles), 3);
SELECT pg_temp.expect('driver cannot see stranger',
  (SELECT count(*) FROM public.profiles WHERE id='00000000-0000-0000-0000-00000000000e'), 0);
SELECT pg_temp.expect('driver sees own driver record', (SELECT count(*) FROM public.drivers), 1);
SELECT pg_temp.expect('driver sees own vehicle', (SELECT count(*) FROM public.vehicles), 1);
SELECT pg_temp.expect('driver sees own location', (SELECT count(*) FROM public.driver_locations), 1);
WITH u AS (UPDATE public.driver_locations SET lat=9.31 RETURNING 1)
SELECT pg_temp.expect('driver can update own location', (SELECT count(*) FROM u), 1);
WITH u AS (UPDATE public.vehicles SET color='Blue' RETURNING 1)
SELECT pg_temp.expect('driver can update own vehicle', (SELECT count(*) FROM u), 1);
RESET ROLE;

-- ================= Admin M =================
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000000f');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect('admin sees all test profiles',
  (SELECT count(*) FROM public.profiles WHERE full_name LIKE '%' AND id::text LIKE '00000000-0000-0000-0000-00000000000%'), 5);
SELECT pg_temp.expect('admin sees test driver',
  (SELECT count(*) FROM public.drivers WHERE id='00000000-0000-0000-0000-0000000000d1'), 1);
SELECT pg_temp.expect('admin sees test vehicle',
  (SELECT count(*) FROM public.vehicles WHERE driver_id='00000000-0000-0000-0000-0000000000d1'), 1);
SELECT pg_temp.expect('admin sees test location',
  (SELECT count(*) FROM public.driver_locations WHERE driver_id='00000000-0000-0000-0000-00000000000d'), 1);
RESET ROLE;

-- ================= Anonymous visitor =================
SET LOCAL ROLE anon;
SELECT pg_temp.expect('anon can read pricing', (SELECT least(count(*),1) FROM public.pricing_settings), 1);
RESET ROLE;

SELECT 'ALL RLS PRIVACY TESTS PASSED' AS result;
ROLLBACK;
