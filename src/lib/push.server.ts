import { buildPushPayload, type PushSubscription, type VapidKeys } from "@block65/webcrypto-web-push";

export type PushMessage = { title: string; body?: string | null; url?: string | null; tag?: string };

function vapid(): VapidKeys | null {
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  const subject = process.env["VAPID_SUBJECT"] ?? "mailto:admin@example.com";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

/** Sends a Web Push to every subscription the user has. Removes expired subscriptions. */
export async function sendPushToUser(userId: string, msg: PushMessage): Promise<number> {
  const keys = vapid();
  if (!keys) return 0;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  let sent = 0;
  for (const s of subs ?? []) {
    const sub: PushSubscription = { endpoint: s.endpoint, expirationTime: null, keys: { p256dh: s.p256dh, auth: s.auth } };
    try {
      const payload = await buildPushPayload(
        { data: JSON.stringify(msg), options: { ttl: 120, urgency: "high" } },
        sub,
        keys,
      );
      const res = await fetch(s.endpoint, payload);
      if (res.status === 404 || res.status === 410) {
        await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
      } else if (res.ok) sent++;
    } catch (e) {
      console.error("push failed", e);
    }
  }
  return sent;
}
