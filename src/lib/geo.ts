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

/** Max distance (km) from Dumaguete center for a fix to be trusted. */
export const SERVICE_AREA_MAX_KM = 40;
/** Fixes coarser than this (m) are likely IP-based guesses, not GPS. */
export const MAX_FIX_ACCURACY_M = 10000;

export type PositionFix = LatLng & { accuracy: number | null; highAccuracy: boolean };

function requestFix(highAccuracy: boolean): Promise<PositionFix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
          highAccuracy,
        }),
      (err) => reject(err),
      highAccuracy
        ? { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
        : { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  });
}

/** High-accuracy fix first; falls back to a coarse fix only if that fails (not on permission denial). */
export async function getPositionFix(): Promise<PositionFix> {
  try {
    return await requestFix(true);
  } catch (err) {
    if ((err as { code?: number } | null)?.code === 1) throw err;
    return requestFix(false);
  }
}

/** True when a fix is close enough to Dumaguete and precise enough to trust. */
export function isPlausibleForServiceArea(lat: number, lng: number, accuracyMeters?: number | null): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (accuracyMeters != null && accuracyMeters > MAX_FIX_ACCURACY_M) return false;
  return haversineKm({ lat, lng }, DEFAULT_CENTER) <= SERVICE_AREA_MAX_KM;
}

export { formatMoney, formatDateTime, formatDate } from "./locale";
