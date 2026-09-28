import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { POPULAR_PLACES } from "./places";

const InputSchema = z.object({
  description: z.string().trim().min(3).max(500),
  savedPlaces: z.array(z.string().max(60)).max(20).default([]),
});

const OutputSchema = z.object({
  vehicle: z.enum(["tricycle", "economy", "comfort", "xl", "bike"]),
  reason: z.string(),
  destination_name: z.string().nullable(),
  destination_query: z.string().nullable(),
  payment: z.enum(["cash", "wallet", "card"]).nullable(),
  notes: z.string().nullable(),
});

export type TripSuggestion = z.infer<typeof OutputSchema>;

export const suggestTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    const { generateTextViaGateway, GatewayError } = await import("./ai-gateway.server");
    const places = POPULAR_PLACES.map((p) => p.name).join("; ");
    const system = `You help riders of Zoomo, a ride-hailing app in Dumaguete City, Bacong, Sibulan and Valencia (Negros Oriental, Philippines).
Ride types: tricycle (up to 4, cheap, short town trips, some luggage), bike (motorcycle habal-habal, 1 passenger, no big luggage, fastest in traffic, good for hilly Valencia roads), economy (car, 4 seats), comfort (newer car, 4 seats, more legroom, good for elderly/airport/business), xl (van/multicab, up to 6, groups or lots of luggage).
Known places: ${places}. Rider's saved places: ${data.savedPlaces.join("; ") || "none"}.
Reply ONLY with a JSON object: {"vehicle": one of tricycle|economy|comfort|xl|bike, "reason": short friendly sentence, "destination_name": exact name from known or saved places or null, "destination_query": address search text if destination is mentioned but not in the lists else null, "payment": cash|wallet|card or null if not mentioned, "notes": short note for the driver or null}.`;
    try {
      const text = await generateTextViaGateway([
        { role: "system", content: system },
        { role: "user", content: data.description },
      ]);
      const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
      const parsed = OutputSchema.safeParse(JSON.parse(json));
      if (!parsed.success) return { ok: false as const, error: "The assistant gave an unclear answer. Try rephrasing your trip." };
      return { ok: true as const, suggestion: parsed.data };
    } catch (e) {
      if (e instanceof GatewayError) return { ok: false as const, error: e.message };
      console.error(e);
      return { ok: false as const, error: "The assistant couldn't answer. Please try again." };
    }
  });
