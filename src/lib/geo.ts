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

export async function getRoute(from: LatLng, to: LatLng): Promise<RouteResult> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("route failed");
    const json = (await res.json()) as {
      routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
    };
    const r = json.routes?.[0];
    if (!r) throw new Error("no route");
    return {
      distanceKm: Math.round((r.distance / 1000) * 100) / 100,
      durationMin: Math.round((r.duration / 60) * 10) / 10,
      coords: r.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
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
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const json = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  return json.map((r) => ({
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    address: r.display_name,
  }));
}

export async function reverseGeocode(p: LatLng): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.lat}&lon=${p.lng}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("reverse failed");
    const json = (await res.json()) as { display_name?: string };
    return json.display_name ?? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
  } catch {
    return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
  }
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

export const DEFAULT_CENTER: LatLng = { lat: 40.7128, lng: -74.006 };

export function formatMoney(n: number | null | undefined, currency = "$"): string {
  return `${currency}${(Number(n ?? 0)).toFixed(2)}`;
}
