import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

function verify(header: string | null, raw: string, secret: string) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const sig = parts["li"] || parts["te"];
  if (!parts["t"] || !sig) return false;
  const expected = createHmac("sha256", secret).update(`${parts["t"]}.${raw}`).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/paymongo-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PAYMONGO_WEBHOOK_SECRET"];
        const apiKey = process.env["PAYMONGO_SECRET_KEY"];
        if (!secret || !apiKey) return new Response("Not configured", { status: 503 });
        const raw = await request.text();
        if (!verify(request.headers.get("paymongo-signature"), raw, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }
        const event = JSON.parse(raw) as {
          data?: { attributes?: { type?: string; data?: { id?: string } } };
        };
        const type = event.data?.attributes?.type;
        const sessionId = event.data?.attributes?.data?.id;
        if (type !== "checkout_session.payment.paid" || !sessionId) return new Response("ignored");

        // Double-check with PayMongo that the session is really paid.
        const res = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${encodeURIComponent(sessionId)}`, {
          headers: { Authorization: `Basic ${btoa(`${apiKey}:`)}` },
        });
        const s = (await res.json().catch(() => null)) as {
          data?: { attributes?: { payments?: { attributes?: { status?: string } }[] } };
        } | null;
        const paid = s?.data?.attributes?.payments?.some((p) => p.attributes?.status === "paid");
        if (!paid) return new Response("not paid", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.rpc("credit_paid_checkout", { _session_id: sessionId });
        if (error) {
          console.error("credit failed", error);
          return new Response("error", { status: 500 });
        }
        return new Response("ok");
      },
    },
  },
});
