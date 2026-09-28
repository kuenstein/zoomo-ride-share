import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CONSENT_VERSION } from "./legal";

export type CheckItem = { id: string; label: string; ok: boolean; detail?: string; fix?: string };

/** Admin-only launch readiness. Reports whether secrets exist; never returns their values. */
export const getLaunchChecklist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { data: s, error } = await context.supabase.rpc("launch_db_status");
    if (error) throw new Error(error.message);
    const db = (s ?? {}) as Record<string, any>;
    const has = (k: string) => !!process.env[k]?.trim();
    const { geocoderName, routerName } = await import("./geo-providers.server");
    const geo = geocoderName();
    const rt = routerName();

    const items: CheckItem[] = [
      {
        id: "paymongo",
        label: "PayMongo secret key and webhook secret set",
        ok: has("PAYMONGO_SECRET_KEY") && has("PAYMONGO_WEBHOOK_SECRET"),
        fix: "Add PAYMONGO_SECRET_KEY (live sk_live_…) and PAYMONGO_WEBHOOK_SECRET in project secrets.",
      },
      {
        id: "qrph",
        label: "QR Ph checkout working",
        ok: !!db.last_paid_topup,
        detail: db.last_paid_topup ? `Last paid top-up: ${new Date(db.last_paid_topup).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}` : "No paid QR Ph top-up yet",
        fix: "Do a ₱100 test top-up from the Wallet page and confirm the balance updates.",
      },
      {
        id: "drivers",
        label: "At least one approved driver",
        ok: Number(db.approved_drivers) > 0,
        detail: `${db.approved_drivers ?? 0} approved`,
        fix: "Review driver documents in the Drivers tab and approve a driver.",
      },
      {
        id: "areas",
        label: "At least one active service area",
        ok: Number(db.active_areas) > 0,
        detail: `${db.active_areas ?? 0} active`,
        fix: "Add or enable a zone in the Areas tab.",
      },
      {
        id: "pricing",
        label: "Pricing configured",
        ok: Number(db.pricing?.tricycle_base) > 0 && Number(db.pricing?.bike_base) > 0 && Number(db.pricing?.commission) >= 0,
        detail: db.pricing
          ? `Tricycle ₱${db.pricing.tricycle_base} + ₱${db.pricing.tricycle_km}/km, Motorcycle ₱${db.pricing.bike_base} + ₱${db.pricing.bike_km}/km, commission ${db.pricing.commission}%`
          : "No pricing row",
        fix: "Open the Pricing tab and confirm your real fares (current values are starting defaults).",
      },
      {
        id: "admins",
        label: "Admin count is 1 or more",
        ok: Number(db.admins) >= 1,
        detail: `${db.admins ?? 0} admin(s)`,
        fix: "Grant the admin role to a trusted account.",
      },
      {
        id: "expiry",
        label: "Ride expiry job running",
        ok: !!db.expiry_job,
        detail: db.expiry_last_run
          ? `Last run ${new Date(db.expiry_last_run).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} (${db.expiry_last_status})`
          : db.expiry_job
            ? "Scheduled, waiting for first run"
            : "Not scheduled",
        fix: "Ask the assistant to re-create the scheduled expiry job.",
      },
      {
        id: "vapid",
        label: "Push notification (VAPID) keys set",
        ok: has("VAPID_PUBLIC_KEY") && has("VAPID_PRIVATE_KEY"),
        detail: `Push dispatch: ${db.push_dispatch_url ? new URL(db.push_dispatch_url).host : "not set"} · ${db.push_subscriptions ?? 0} device(s)`,
        fix: "Add VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT secrets. After publishing, switch the push address to your live site.",
      },
      {
        id: "consent",
        label: "Legal consent version set",
        ok: !!CONSENT_VERSION,
        detail: `Version ${CONSENT_VERSION} — legal pages are templates until reviewed by a lawyer`,
        fix: "Have a Philippine lawyer review /terms and /privacy, then bump the consent version.",
      },
      {
        id: "maps",
        label: "Production maps provider configured",
        ok: geo !== "nominatim" || rt !== "osrm" ? true : has("MAPS_CONTACT_EMAIL") && (has("NOMINATIM_URL") || has("OSRM_URL")),
        detail: `Search: ${geo}, routing: ${rt}${has("MAPS_CONTACT_EMAIL") ? "" : " · MAPS_CONTACT_EMAIL not set"}`,
        fix: "Set GEOCODER_PROVIDER + a key (GEOAPIFY_API_KEY, MAPTILER_API_KEY or MAPBOX_TOKEN) and ROUTING_PROVIDER + key (ORS_API_KEY, MAPBOX_TOKEN or GEOAPIFY_API_KEY), or self-host NOMINATIM_URL / OSRM_URL. Also set MAPS_CONTACT_EMAIL.",
      },
    ];
    return { items };
  });
