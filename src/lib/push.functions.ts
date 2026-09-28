import { createServerFn } from "@tanstack/react-start";

/** The VAPID public key is not secret — browsers need it to subscribe. */
export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env["VAPID_PUBLIC_KEY"] ?? null };
});
