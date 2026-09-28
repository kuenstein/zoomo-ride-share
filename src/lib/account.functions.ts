import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Deletes a user's personal data. Completed rides, wallet ledger and payments are kept
 * for accounting, but the identity attached to them is anonymized and the login is disabled.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: active } = await supabaseAdmin
      .from("rides")
      .select("id")
      .or(`rider_id.eq.${uid},driver_id.eq.${uid}`)
      .in("status", ["requested", "accepted", "arriving", "in_progress"])
      .limit(1);
    if (active && active.length) return { ok: false as const, error: "Finish or cancel your active trip first." };

    // Driver documents (files + rows)
    const { data: files } = await supabaseAdmin.storage.from("driver-documents").list(uid);
    if (files?.length) await supabaseAdmin.storage.from("driver-documents").remove(files.map((f) => `${uid}/${f.name}`));
    await supabaseAdmin.from("driver_documents").delete().eq("user_id", uid);

    await supabaseAdmin.from("saved_places").delete().eq("user_id", uid);
    await supabaseAdmin.from("ride_messages").delete().eq("sender_id", uid);
    await supabaseAdmin.from("trusted_contacts").delete().eq("user_id", uid);
    await supabaseAdmin.from("push_subscriptions").delete().eq("user_id", uid);
    await supabaseAdmin.from("notifications").delete().eq("user_id", uid);
    await supabaseAdmin.from("driver_locations").delete().eq("driver_id", uid);
    await supabaseAdmin.from("drivers").update({ is_online: false, license_number: "DELETED", status: "suspended" }).eq("user_id", uid);
    await supabaseAdmin.from("ratings").update({ comment: null }).eq("rater_id", uid);
    await supabaseAdmin.from("driver_feedback").update({ comment: null }).eq("rider_id", uid);
    await supabaseAdmin
      .from("profiles")
      .update({ full_name: "Deleted user", phone: null, avatar_url: null, deleted_at: new Date().toISOString() })
      .eq("id", uid);

    // Disable the login and scrub the email. The auth record stays so ride/payment
    // history (which references it) is not deleted along with it.
    const { error } = await supabaseAdmin.auth.admin.updateUserById(uid, {
      email: `deleted-${uid}@deleted.invalid`,
      ban_duration: "876000h",
      user_metadata: { full_name: "Deleted user", phone: null, avatar_url: null, name: null },
    });
    if (error) return { ok: false as const, error: "Your data was removed, but we couldn't close the login. Contact support." };
    return { ok: true as const };
  });
