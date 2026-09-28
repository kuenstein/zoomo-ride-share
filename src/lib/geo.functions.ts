import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RATE_PER_MIN = 30;
const CACHE_TTL_MS = 24 * 3600_000;

async function withCache<T>(userId: string, key: string, fn: () => Promise<T>): Promise<{ value: T | null; limited?: boolean }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: hit } = await supabaseAdmin.from("geo_cache").select("value, created_at").eq("key", key).maybeSingle();
  if (hit && Date.now() - new Date(hit.created_at).getTime() < CACHE_TTL_MS) return { value: hit.value as T };
  const { data: ok } = await supabaseAdmin.rpc("geo_hit", { _user: userId, _limit: RATE_PER_MIN });
  if (ok === false) return { value: null, limited: true };
  const value = await fn();
  await supabaseAdmin.from("geo_cache").upsert({ key, value: value as never, created_at: new Date().toISOString() });
  return { value };
}

const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

export const geoSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().trim().min(3).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { geocode, geocoderName } = await import("./geo-providers.server");
    const key = `s:${geocoderName()}:${data.q.toLowerCase()}`;
    try {
      const r = await withCache(context.userId, key, () => geocode(data.q));
      return { places: r.value ?? [], limited: !!r.limited };
    } catch {
      return { places: [], limited: false };
    }
  });

export const geoReverse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).parse(d))
  .handler(async ({ data, context }) => {
    const { reverse, geocoderName } = await import("./geo-providers.server");
    const key = `r:${geocoderName()}:${round(data.lat)},${round(data.lng)}`;
    try {
      const r = await withCache(context.userId, key, () => reverse(data.lat, data.lng));
      return { address: r.value ?? null };
    } catch {
      return { address: null };
    }
  });

export const geoRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        from: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
        to: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { route, routerName } = await import("./geo-providers.server");
    const key = `t:${routerName()}:${round(data.from.lat)},${round(data.from.lng)};${round(data.to.lat)},${round(data.to.lng)}`;
    try {
      const r = await withCache(context.userId, key, () => route(data.from, data.to));
      return { route: r.value };
    } catch {
      return { route: null };
    }
  });
