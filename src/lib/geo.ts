export type LatLng = { lat: number; lng: number };
export type Place = LatLng & { address: string };

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type RouteResult = {
  distanceKm: number;
  durationMin: number;
  coords: [number, number][];
  fallback: boolean;
};

// All provider traffic goes through the server (caching, rate limits, provider swap by env vars).
export async function getRoute(from: LatLng, to: LatLng): Promise<RouteResult> {
  try {
    const { geoRoute } = await import("./geo.functions");
    const { route } = await geoRoute({ data: { from, to } });
    if (!route) throw new Error("no route");
    return {
      distanceKm: Math.round(route.distanceKm * 100) / 100,
      durationMin: Math.round(route.durationMin * 10) / 10,
      coords: route.coords,
      fallback: false,
    };
  } catch {
    const km = Math.round(haversineKm(from, to) * 1.35 * 100) / 100;
    return {
      distanceKm: km,
      durationMin: Math.max(3, Math.round((km / 28) * 60 * 10) / 10),
      coords: [
        [from.lat, from.lng],
        [to.lat, to.lng],
      ],
      fallback: true,
    };
  }
}

export async function searchAddress(query: string): Promise<Place[]> {
  if (query.trim().length < 3) return [];
  try {
    const { geoSearch } = await import("./geo.functions");
    const r = await geoSearch({ data: { q: query.trim() } });
    return r.places;
  } catch {
    return [];
  }
}

export async function reverseGeocode(p: LatLng): Promise<string> {
  const fallback = `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
  try {
    const { geoReverse } = await import("./geo.functions");
    const r = await geoReverse({ data: p });
    return r.address ?? fallback;
  } catch {
    return fallback;
  }
}

/** Debounce helper for address search inputs (default 350 ms). */
export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms = 350) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...a: A) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

export function getCurrentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  });
}

export const DEFAULT_CENTER: LatLng = { lat: 9.3068, lng: 123.3054 };
export const DEFAULT_ZOOM = 13;

export { formatMoney, formatDateTime, formatDate } from "./locale";
