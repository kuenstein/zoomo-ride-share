import { supabase } from "@/integrations/supabase/client";
import { getVapidPublicKey } from "./push.functions";

/** Service workers must never run inside the editor preview / iframes / dev. */
export function swAllowed() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  if (import.meta.env.DEV) return false;
  let framed = false;
  try {
    framed = window.self !== window.top;
  } catch {
    framed = true;
  }
  const h = window.location.hostname;
  if (framed || h.startsWith("id-preview--") || h.includes("lovableproject.com") || h === "localhost") return false;
  return true;
}

export async function registerSW() {
  if (!swAllowed()) {
    // Clean up any worker left from an earlier visit in a preview context.
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
      for (const r of regs) if (r.active?.scriptURL.endsWith("/sw.js")) await r.unregister();
    }
    return null;
  }
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export function pushSupported() {
  return typeof window !== "undefined" && "PushManager" in window && "Notification" in window && swAllowed();
}

export function isIos() {
  return typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
}
export function isStandalone() {
  return typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
}

function b64ToUint8(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function enablePush(userId: string): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: perm };
  const reg = (await registerSW()) ?? (await navigator.serviceWorker.ready);
  const { key } = await getVapidPublicKey();
  if (!key) return { ok: false, reason: "server" };
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(key) });
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await supabase.from("push_subscriptions").delete().eq("endpoint", j.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: userId,
    endpoint: j.endpoint,
    p256dh: j.keys.p256dh,
    auth: j.keys.auth,
    user_agent: navigator.userAgent.slice(0, 200),
  });
  return error ? { ok: false, reason: "save" } : { ok: true };
}

export async function disablePush() {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
}
