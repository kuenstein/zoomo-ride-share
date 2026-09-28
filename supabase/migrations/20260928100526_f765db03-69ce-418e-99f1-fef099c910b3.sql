REVOKE EXECUTE ON FUNCTION public.protect_driver_documents() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.dispatch_push() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_ride_events() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_driver_status() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.require_driver_docs_on_apply() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.protect_profile_fields() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.driver_docs_complete(uuid,boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.driver_license_expired(uuid) FROM authenticated;