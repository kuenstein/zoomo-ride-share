-- Regression tests for signup roles, ride update protection, distance validation,
-- cash-trip accounting and payouts. Runs in a transaction and ROLLS BACK.
BEGIN;

CREATE FUNCTION pg_temp.expect(label text, actual numeric, expected numeric) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'TEST FAILED: % (expected %, got %)', label, expected, actual;
  END IF; END $$;
CREATE FUNCTION pg_temp.expect_error(label text, stmt text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
  BEGIN EXECUTE stmt; EXCEPTION WHEN OTHERS THEN RETURN; END;
  RAISE EXCEPTION 'TEST FAILED: % (statement was allowed)', label;
END $$;
CREATE FUNCTION pg_temp.act_as(uid text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role','authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', uid, true);
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated;

-- ===== 1. Signup metadata cannot create an admin (real trigger runs) =====
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-0000000000a1','t-evil@test.local','authenticated','authenticated','{"role":"admin"}'),
  ('00000000-0000-0000-0000-0000000000a2','t-junk@test.local','authenticated','authenticated','{"role":"superuser"}'),
  ('00000000-0000-0000-0000-0000000000a3','t-drv@test.local','authenticated','authenticated','{"role":"driver"}');
SELECT pg_temp.expect('signup role=admin creates no admin',
  (SELECT count(*) FROM public.user_roles WHERE user_id='00000000-0000-0000-0000-0000000000a1' AND role='admin'), 0);
SELECT pg_temp.expect('signup role=admin becomes rider',
  (SELECT count(*) FROM public.user_roles WHERE user_id='00000000-0000-0000-0000-0000000000a1' AND role='rider'), 1);
SELECT pg_temp.expect('invalid role becomes rider',
  (SELECT count(*) FROM public.user_roles WHERE user_id='00000000-0000-0000-0000-0000000000a2' AND role='rider'), 1);
SELECT pg_temp.expect('driver signup keeps driver',
  (SELECT count(*) FROM public.user_roles WHERE user_id='00000000-0000-0000-0000-0000000000a3' AND role='driver'), 1);

SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error('user cannot self-grant admin',
  $q$INSERT INTO public.user_roles (user_id, role) VALUES ('00000000-0000-0000-0000-0000000000a1','admin')$q$);
RESET ROLE;

-- ===== fixtures: rider a1, driver a3 (approved), rides =====
SET LOCAL session_replication_role = replica;
INSERT INTO public.drivers (id, user_id, license_number, status) VALUES
  ('00000000-0000-0000-0000-0000000000d3','00000000-0000-0000-0000-0000000000a3','LTO-T','approved');
INSERT INTO public.vehicles (driver_id, type, make, model, color, plate) VALUES
  ('00000000-0000-0000-0000-0000000000d3','tricycle','Honda','TMX','Red','T-1');
INSERT INTO public.rides (id, rider_id, driver_id, status, vehicle_type, pickup_lat, pickup_lng, pickup_address, dropoff_lat, dropoff_lng, dropoff_address, fare_estimate, payment_method) VALUES
  ('00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a3','accepted','tricycle',9.30,123.30,'A',9.31,123.31,'B',100,'cash'),
  ('00000000-0000-0000-0000-00000000c002','00000000-0000-0000-0000-0000000000a1',NULL,'in_progress','tricycle',9.30,123.30,'A',9.31,123.31,'B',100,'cash');
UPDATE public.wallets SET balance = 0 WHERE user_id='00000000-0000-0000-0000-0000000000a3';
SET LOCAL session_replication_role = origin;

-- ===== 2. Rider cannot tamper with rides =====
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error('rider cannot set status completed',
  $q$UPDATE public.rides SET status='completed' WHERE id='00000000-0000-0000-0000-00000000c001'$q$);
SELECT pg_temp.expect_error('rider cannot change driver_id',
  $q$UPDATE public.rides SET driver_id='00000000-0000-0000-0000-0000000000a1' WHERE id='00000000-0000-0000-0000-00000000c001'$q$);
SELECT pg_temp.expect_error('rider cannot change distance',
  $q$UPDATE public.rides SET distance_km=0.1 WHERE id='00000000-0000-0000-0000-00000000c001'$q$);
SELECT pg_temp.expect_error('rider cannot cancel an in-progress trip',
  $q$UPDATE public.rides SET status='cancelled' WHERE id='00000000-0000-0000-0000-00000000c002'$q$);

-- ===== 4. Client cannot lower distance on booking =====
INSERT INTO public.rides (id, rider_id, vehicle_type, pickup_lat, pickup_lng, pickup_address, dropoff_lat, dropoff_lng, dropoff_address, distance_km, duration_min, payment_method)
VALUES ('00000000-0000-0000-0000-00000000c003','00000000-0000-0000-0000-0000000000a1','bike',9.3068,123.3054,'A',9.3300,123.3000,'B',0.1,5,'cash');
SELECT pg_temp.expect('tiny distance replaced by straight-line x1.2',
  (SELECT distance_km FROM public.rides WHERE id='00000000-0000-0000-0000-00000000c003'),
  ROUND((public.haversine_km(9.3068,123.3054,9.3300,123.3000) * 1.2)::numeric, 2));
SELECT pg_temp.expect_error('negative duration rejected',
  $q$INSERT INTO public.rides (rider_id, vehicle_type, pickup_lat, pickup_lng, pickup_address, dropoff_lat, dropoff_lng, dropoff_address, distance_km, duration_min, payment_method)
     VALUES ('00000000-0000-0000-0000-0000000000a1','bike',9.3068,123.3054,'A',9.33,123.30,'B',3,-1,'cash')$q$);
-- rider may cancel a requested ride
SELECT pg_temp.expect('rider can cancel requested ride',
  ((public.rider_cancel_ride('00000000-0000-0000-0000-00000000c003'))->>'success')::boolean::int, 1);
RESET ROLE;

-- ===== 3/5. Driver transitions + cash completion =====
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000a3');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error('driver cannot jump accepted -> in_progress',
  $q$UPDATE public.rides SET status='in_progress' WHERE id='00000000-0000-0000-0000-00000000c001'$q$);
SELECT pg_temp.expect('complete_ride refuses a trip not started',
  ((public.complete_ride('00000000-0000-0000-0000-00000000c001', 0))->>'success')::boolean::int, 0);
SELECT pg_temp.expect('driver marks arrived',
  ((public.driver_set_ride_status('00000000-0000-0000-0000-00000000c001','arriving'))->>'success')::boolean::int, 1);
SELECT pg_temp.expect('driver starts trip',
  ((public.driver_set_ride_status('00000000-0000-0000-0000-00000000c001','in_progress'))->>'success')::boolean::int, 1);
RESET ROLE;
-- one active ride per driver: retire c001, hand c002 to the driver
SET LOCAL session_replication_role = replica;
UPDATE public.rides SET status='cancelled' WHERE id='00000000-0000-0000-0000-00000000c001';
UPDATE public.rides SET driver_id='00000000-0000-0000-0000-0000000000a3' WHERE id='00000000-0000-0000-0000-00000000c002';
SET LOCAL session_replication_role = origin;
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000a3');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect('cash trip completes',
  ((public.complete_ride('00000000-0000-0000-0000-00000000c002', 0))->>'success')::boolean::int, 1);
RESET ROLE;

SELECT pg_temp.expect('cash trip debits commission from driver wallet',
  (SELECT balance FROM public.wallets WHERE user_id='00000000-0000-0000-0000-0000000000a3'),
  -(SELECT ROUND(100 * commission_percent / 100.0, 2) FROM public.pricing_settings WHERE id=1));
SELECT pg_temp.expect('cash trip gives no wallet earning',
  (SELECT count(*) FROM public.wallet_transactions WHERE user_id='00000000-0000-0000-0000-0000000000a3' AND kind='earning'), 0);
SELECT pg_temp.expect('ride records commission',
  (SELECT commission FROM public.rides WHERE id='00000000-0000-0000-0000-00000000c002'),
  (SELECT ROUND(100 * commission_percent / 100.0, 2) FROM public.pricing_settings WHERE id=1));

-- ===== 6. Payout cannot exceed balance =====
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000a3');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect('payout above balance refused',
  ((public.request_payout(100, '09171234567 GCash'))->>'success')::boolean::int, 0);
RESET ROLE;

INSERT INTO public.payment_checkouts (user_id, amount, method) VALUES ('00000000-0000-0000-0000-0000000000a1', 100, 'qrph');
SELECT pg_temp.expect('qrph checkout row inserts',
  (SELECT count(*) FROM public.payment_checkouts WHERE user_id='00000000-0000-0000-0000-0000000000a1' AND method='qrph'), 1);

SELECT 'ALL RIDE/MONEY PROTECTION TESTS PASSED' AS result;
ROLLBACK;
