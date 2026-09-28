import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  amount: z.number().int().min(50).max(10000),
  origin: z.string().url().refine((u) => /^https?:\/\//.test(u)),
});

/** Creates a PayMongo checkout for a wallet top-up. The wallet is credited only by the verified webhook. */
export const createTopupCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const secret = process.env["PAYMONGO_SECRET_KEY"];
    if (!secret) return { ok: false as const, error: "QR Ph payments aren't set up yet." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("payment_checkouts")
      .insert({ user_id: context.userId, amount: data.amount, method: "qrph" })
      .select("id")
      .single();
    if (error || !row) return { ok: false as const, error: "Could not start payment." };

    const res = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${secret}:`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [{ name: "Zoomo wallet top-up", amount: data.amount * 100, currency: "PHP", quantity: 1 }],
            payment_method_types: ["qrph"],
            description: `Zoomo wallet top-up`,
            reference_number: row.id,
            send_email_receipt: false,
            success_url: `${data.origin}/wallet?topup=success`,
            cancel_url: `${data.origin}/wallet?topup=cancelled`,
            metadata: { checkout_id: row.id },
          },
        },
      }),
    });
    const body = (await res.json().catch(() => null)) as
      | { data?: { id: string; attributes: { checkout_url: string } } }
      | null;
    if (!res.ok || !body?.data) {
      console.error("PayMongo checkout failed", res.status, JSON.stringify(body));
      await supabaseAdmin.from("payment_checkouts").update({ status: "failed" }).eq("id", row.id);
      if (/qrph|payment_method/i.test(JSON.stringify(body ?? ""))) {
        return { ok: false as const, error: "QR Ph isn't enabled on this payment account yet." };
      }
      return { ok: false as const, error: "The payment provider declined the request. Please try again." };
    }
    await supabaseAdmin.from("payment_checkouts").update({ provider_session_id: body.data.id }).eq("id", row.id);
    return { ok: true as const, url: body.data.attributes.checkout_url };
  });
