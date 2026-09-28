-- Regression tests for launch-readiness tables: driver_documents, safety_incidents,
-- reports, trusted_contacts, push_subscriptions, geo cache, consent protection and
-- the "all documents approved" driver approval rule.
-- Runs inside a transaction and ROLLS BACK. Any failed check raises an exception.
BEGIN;

SET LOCAL session_replication_role = replica;
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-0000-0000-0000000000a1','lr-rider@test.local','authenticated','authenticated'),
  ('00000000-0000-0000-0000-0000000000d1','lr-driver@test.local','authenticated','authenticated'),
  ('00000000-0000-0000-0000-0000000000e1','lr-stranger@test.local','authenticated','authenticated'),
  ('00000000-0000-0000-0000-0000000000f1','lr-admin@test.local','authenticated','authenticated'),
  ('00000000-0000-0000-0000-0000000000d2','lr-newdriver@test.local','authenticated','authenticated');
INSERT INTO public.profiles (id, full_name) VALUES
  ('00000000-0000-0000-0000-0000000000a1','Rider'),('00000000-0000-0000-0000-0000000000d1','Driver'),
  ('00000000-0000-0000-0000-0000000000e1','Stranger'),('00000000-0000-0000-0000-0000000000f1','Admin'),
  ('00000000-0000-0000-0000-0000000000d2','New Driver');
INSERT INTO public.user_roles (user_id, role) VALUES ('00000000-0000-0000-0000-0000000000f1','admin');
INSERT INTO public.drivers (id, user_id, license_number, status) VALUES
  ('00000000-0000-0000-0000-00000000dd01','00000000-0000-0000-0000-0000000000d1','LTO-1','pending');
INSERT INTO public.driver_documents (user_id, doc_type, storage_path, status) VALUES
  ('00000000-0000-0000-0000-0000000000d1','license','00000000-0000-0000-0000-0000000000d1/l.jpg','pending'),
  ('00000000-0000-0000-0000-0000000000d1','orcr','00000000-0000-0000-0000-0000000000d1/o.jpg','pending'),
  ('00000000-0000-0000-0000-0000000000d1','vehicle','00000000-0000-0000-0000-0000000000d1/v.jpg','pending'),
  ('00000000-0000-0000-0000-0000000000d1','selfie','00000000-0000-0000-0000-0000000000d1/s.jpg','pending');
INSERT INTO public.rides (id, rider_id, driver_id, status, vehicle_type, pickup_lat, pickup_lng, pickup_address, dropoff_lat, dropoff_lng, dropoff_address) VALUES
  ('00000000-0000-0000-0000-00000000aa01','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d1','in_progress','tricycle',9.30,123.30,'A',9.31,123.31,'B'),
  ('00000000-0000-0000-0000-00000000aa02','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d1','completed','tricycle',9.30,123.30,'A',9.31,123.31,'B');
INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth) VALUES
  ('00000000-0000-0000-0000-0000000000a1','https://push.test/a1','k','a');
INSERT INTO public.trusted_contacts (user_id, name, phone) VALUES
  ('00000000-0000-0000-0000-0000000000a1','Mama','09171234567');
INSERT INTO public.geo_cache (key, value) VALUES ('test-key','{}');
SET LOCAL session_replication_role = origin;

CREATE FUNCTION pg_temp.expect(label text, actual bigint, expected bigint) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'LAUNCH RLS TEST FAILED: % (expected %, got %)', label, expected, actual; END IF; END $$;
CREATE FUNCTION pg_temp.act_as(uid text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role','authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', uid, true); END $$;
CREATE FUNCTION pg_temp.fails(sql text) RETURNS bigint LANGUAGE plpgsql AS $$ BEGIN
  EXECUTE sql; RETURN 0; EXCEPTION WHEN OTHERS THEN RETURN 1; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated;

-- ===== Rider raises SOS on active trip; files a report on the completed trip =====
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect('rider can raise SOS on active trip',
  (SELECT CASE WHEN (public.raise_sos('00000000-0000-0000-0000-00000000aa01', 9.3, 123.3)->>'success')::boolean THEN 1 ELSE 0 END), 1);
SELECT pg_temp.expect('rider cannot raise SOS on completed trip',
  (SELECT CASE WHEN (public.raise_sos('00000000-0000-0000-0000-00000000aa02')->>'success')::boolean THEN 1 ELSE 0 END), 0);
SELECT pg_temp.expect('rider reads own incident', (SELECT count(*) FROM public.safety_incidents), 1);
SELECT pg_temp.expect('rider cannot update incident status',
  (WITH u AS (UPDATE public.safety_incidents SET status='resolved' RETURNING 1) SELECT count(*) FROM u), 0);
SELECT pg_temp.expect('rider cannot insert incident directly',
  pg_temp.fails($q$INSERT INTO public.safety_incidents (ride_id, reporter_id, reporter_role) VALUES ('00000000-0000-0000-0000-00000000aa01','00000000-0000-0000-0000-0000000000a1','rider')$q$), 1);
INSERT INTO public.reports (ride_id, reporter_id, category, details)
  VALUES ('00000000-0000-0000-0000-00000000aa02','00000000-0000-0000-0000-0000000000a1','overcharge','test');
SELECT pg_temp.expect('rider cannot report an active (not completed) trip',
  pg_temp.fails($q$INSERT INTO public.reports (ride_id, reporter_id, category, details) VALUES ('00000000-0000-0000-0000-00000000aa01','00000000-0000-0000-0000-0000000000a1','other','x')$q$), 1);
SELECT pg_temp.expect('rider reads own push subscription', (SELECT count(*) FROM public.push_subscriptions), 1);
SELECT pg_temp.expect('rider reads own trusted contact', (SELECT count(*) FROM public.trusted_contacts), 1);
SELECT pg_temp.expect('rider cannot read driver documents', (SELECT count(*) FROM public.driver_documents), 0);
SELECT pg_temp.expect('rider cannot read geo cache', pg_temp.fails('SELECT 1 FROM public.geo_cache'), 1);
UPDATE public.profiles SET consent_version = 'forged', full_name = 'Rider 2' WHERE id = '00000000-0000-0000-0000-0000000000a1';
SELECT pg_temp.expect('consent version cannot be forged by direct update',
  (SELECT count(*) FROM public.profiles WHERE id='00000000-0000-0000-0000-0000000000a1' AND consent_version = 'forged'), 0);
RESET ROLE;

-- ===== Driver (other trip party) =====
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect('driver sees own 4 documents', (SELECT count(*) FROM public.driver_documents), 4);
UPDATE public.driver_documents SET status='approved' WHERE user_id='00000000-0000-0000-0000-0000000000d1';
SELECT pg_temp.expect('driver cannot self-approve documents',
  (SELECT count(*) FROM public.driver_documents WHERE status='approved'), 0);
SELECT pg_temp.expect('driver cannot read rider''s incident', (SELECT count(*) FROM public.safety_incidents), 0);
SELECT pg_temp.expect('driver cannot read rider''s report', (SELECT count(*) FROM public.reports), 0);
SELECT pg_temp.expect('driver cannot read rider''s push subscriptions', (SELECT count(*) FROM public.push_subscriptions), 0);
SELECT pg_temp.expect('driver cannot read rider''s trusted contacts', (SELECT count(*) FROM public.trusted_contacts), 0);
SELECT pg_temp.expect('driver cannot insert a push subscription for someone else',
  pg_temp.fails($q$INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ('00000000-0000-0000-0000-0000000000a1','https://push.test/x','k','a')$q$), 1);
RESET ROLE;

-- ===== New driver cannot apply without documents =====
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000d2');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect('driver application requires 4 documents',
  pg_temp.fails($q$INSERT INTO public.drivers (user_id, license_number) VALUES ('00000000-0000-0000-0000-0000000000d2','X')$q$), 1);
SELECT pg_temp.expect('cannot upload a document row pointing at another user''s folder',
  pg_temp.fails($q$INSERT INTO public.driver_documents (user_id, doc_type, storage_path) VALUES ('00000000-0000-0000-0000-0000000000d2','license','00000000-0000-0000-0000-0000000000d1/x.jpg')$q$), 1);
RESET ROLE;

-- ===== Stranger =====
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect('stranger cannot raise SOS on others'' trip',
  (SELECT CASE WHEN (public.raise_sos('00000000-0000-0000-0000-00000000aa01')->>'success')::boolean THEN 1 ELSE 0 END), 0);
SELECT pg_temp.expect('stranger sees no documents', (SELECT count(*) FROM public.driver_documents), 0);
SELECT pg_temp.expect('stranger sees no incidents', (SELECT count(*) FROM public.safety_incidents), 0);
SELECT pg_temp.expect('stranger sees no reports', (SELECT count(*) FROM public.reports), 0);
SELECT pg_temp.expect('stranger cannot report others'' trip',
  pg_temp.fails($q$INSERT INTO public.reports (ride_id, reporter_id, category, details) VALUES ('00000000-0000-0000-0000-00000000aa02','00000000-0000-0000-0000-0000000000e1','other','x')$q$), 1);
SELECT pg_temp.expect('stranger cannot read storage objects of driver docs',
  (SELECT count(*) FROM storage.objects WHERE bucket_id='driver-documents'), 0);
RESET ROLE;

-- ===== Admin =====
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect('admin reads all documents', (SELECT count(*) FROM public.driver_documents), 4);
SELECT pg_temp.expect('admin reads incidents', (SELECT count(*) FROM public.safety_incidents), 1);
SELECT pg_temp.expect('admin reads reports', (SELECT count(*) FROM public.reports), 1);
SELECT pg_temp.expect('admin cannot read users'' push subscriptions', (SELECT count(*) FROM public.push_subscriptions), 0);
SELECT pg_temp.expect('admin cannot approve driver before documents are approved',
  pg_temp.fails($q$UPDATE public.drivers SET status='approved' WHERE id='00000000-0000-0000-0000-00000000dd01'$q$), 1);
UPDATE public.driver_documents SET status='approved' WHERE user_id='00000000-0000-0000-0000-0000000000d1';
UPDATE public.drivers SET status='approved' WHERE id='00000000-0000-0000-0000-00000000dd01';
SELECT pg_temp.expect('admin approves driver once all documents approved',
  (SELECT count(*) FROM public.drivers WHERE id='00000000-0000-0000-0000-00000000dd01' AND status='approved'), 1);
UPDATE public.safety_incidents SET status='resolved';
SELECT pg_temp.expect('admin resolves incident', (SELECT count(*) FROM public.safety_incidents WHERE status='resolved'), 1);
RESET ROLE;

-- ===== Expired license blocks going online =====
UPDATE public.drivers SET license_expiry = current_date - 1 WHERE id='00000000-0000-0000-0000-00000000dd01';
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect('expired license cannot go online',
  pg_temp.fails($q$UPDATE public.drivers SET is_online=true WHERE user_id='00000000-0000-0000-0000-0000000000d1'$q$), 1);
RESET ROLE;

SELECT 'launch_rls: all checks passed' AS result;
ROLLBACK;
