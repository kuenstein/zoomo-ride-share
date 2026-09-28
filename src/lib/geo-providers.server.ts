// Swappable geocoding / routing adapters. Pick providers with environment variables:
//   GEOCODER_PROVIDER = nominatim | geoapify | maptiler | mapbox   (default nominatim)
//   ROUTING_PROVIDER  = osrm | openrouteservice | mapbox | geoapify (default osrm)
//   GEOAPIFY_API_KEY, MAPTILER_API_KEY, MAPBOX_TOKEN, ORS_API_KEY
//   NOMINATIM_URL, OSRM_URL (self-hosted instances), MAPS_CONTACT_EMAIL (User-Agent contact)

export type GeoPlace = { lat: number; lng: number; address: string };
export type GeoRoute = { distanceKm: number; durationMin: number; coords: [number, number][] };

// Negros Oriental bias box (lng/lat)
const BOX = { minLng: 123.15, minLat: 9.18, maxLng: 123.4, maxLat: 9.45 };
const CENTER = { lat: 9.3068, lng: 123.3054 };

const env = (k: string) => process.env[k]?.trim() || undefined;

function ua() {
  return `ZoomoRides/1.0 (${env("MAPS_CONTACT_EMAIL") ?? "contact-not-set"})`;
}

export function geocoderName() {
  const p = env("GEOCODER_PROVIDER") ?? "nominatim";
  if (p === "geoapify" && env("GEOAPIFY_API_KEY")) return p;
  if (p === "maptiler" && env("MAPTILER_API_KEY")) return p;
  if (p === "mapbox" && env("MAPBOX_TOKEN")) return p;
  return "nominatim";
}
export function routerName() {
  const p = env("ROUTING_PROVIDER") ?? "osrm";
  if (p === "openrouteservice" && env("ORS_API_KEY")) return p;
  if (p === "mapbox" && env("MAPBOX_TOKEN")) return p;
  if (p === "geoapify" && env("GEOAPIFY_API_KEY")) return p;
  return "osrm";
}

async function getJson(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", "User-Agent": ua(), Referer: "https://zoomo.app", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`provider ${res.status}`);
  return res.json();
}

export async function geocode(q: string): Promise<GeoPlace[]> {
  const e = encodeURIComponent(q);
  switch (geocoderName()) {
    case "geoapify": {
      const j = await getJson(
        `https://api.geoapify.com/v1/geocode/search?text=${e}&filter=countrycode:ph&bias=rect:${BOX.minLng},${BOX.minLat},${BOX.maxLng},${BOX.maxLat}&limit=6&format=json&apiKey=${env("GEOAPIFY_API_KEY")}`,
      );
      return (j.results ?? []).map((r: any) => ({ lat: r.lat, lng: r.lon, address: r.formatted }));
    }
    case "maptiler": {
      const j = await getJson(
        `https://api.maptiler.com/geocoding/${e}.json?country=ph&proximity=${CENTER.lng},${CENTER.lat}&limit=6&key=${env("MAPTILER_API_KEY")}`,
      );
      return (j.features ?? []).map((f: any) => ({ lat: f.center[1], lng: f.center[0], address: f.place_name }));
    }
    case "mapbox": {
      const j = await getJson(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${e}.json?country=ph&proximity=${CENTER.lng},${CENTER.lat}&limit=6&access_token=${env("MAPBOX_TOKEN")}`,
      );
      return (j.features ?? []).map((f: any) => ({ lat: f.center[1], lng: f.center[0], address: f.place_name }));
    }
    default: {
      const base = env("NOMINATIM_URL") ?? "https://nominatim.openstreetmap.org";
      const j = await getJson(
        `${base}/search?format=json&limit=6&countrycodes=ph&viewbox=${BOX.minLng},${BOX.maxLat},${BOX.maxLng},${BOX.minLat}&bounded=0&q=${e}`,
      );
      return (j ?? []).map((r: any) => ({ lat: parseFloat(r.lat), lng: parseFloat(r.lon), address: r.display_name }));
    }
  }
}

export async function reverse(lat: number, lng: number): Promise<string | null> {
  switch (geocoderName()) {
    case "geoapify": {
      const j = await getJson(`https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&format=json&apiKey=${env("GEOAPIFY_API_KEY")}`);
      return j.results?.[0]?.formatted ?? null;
    }
    case "maptiler": {
      const j = await getJson(`https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${env("MAPTILER_API_KEY")}`);
      return j.features?.[0]?.place_name ?? null;
    }
    case "mapbox": {
      const j = await getJson(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${env("MAPBOX_TOKEN")}`);
      return j.features?.[0]?.place_name ?? null;
    }
    default: {
      const base = env("NOMINATIM_URL") ?? "https://nominatim.openstreetmap.org";
      const j = await getJson(`${base}/reverse?format=json&lat=${lat}&lon=${lng}`);
      return j.display_name ?? null;
    }
  }
}

const toLatLng = (c: [number, number][]) => c.map(([lng, lat]) => [lat, lng] as [number, number]);

export async function route(a: { lat: number; lng: number }, b: { lat: number; lng: number }): Promise<GeoRoute> {
  switch (routerName()) {
    case "openrouteservice": {
      const j = await getJson(
        `https://api.openrouteservice.org/v2/directions/driving-car?start=${a.lng},${a.lat}&end=${b.lng},${b.lat}`,
        { headers: { Authorization: env("ORS_API_KEY")! } },
      );
      const f = j.features?.[0];
      if (!f) throw new Error("no route");
      return {
        distanceKm: f.properties.summary.distance / 1000,
        durationMin: f.properties.summary.duration / 60,
        coords: toLatLng(f.geometry.coordinates),
      };
    }
    case "geoapify": {
      const j = await getJson(
        `https://api.geoapify.com/v1/routing?waypoints=${a.lat},${a.lng}|${b.lat},${b.lng}&mode=drive&apiKey=${env("GEOAPIFY_API_KEY")}`,
      );
      const f = j.features?.[0];
      if (!f) throw new Error("no route");
      const coords = (f.geometry.type === "MultiLineString" ? f.geometry.coordinates.flat() : f.geometry.coordinates) as [number, number][];
      return { distanceKm: f.properties.distance / 1000, durationMin: f.properties.time / 60, coords: toLatLng(coords) };
    }
    case "mapbox": {
      const j = await getJson(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${a.lng},${a.lat};${b.lng},${b.lat}?geometries=geojson&overview=full&access_token=${env("MAPBOX_TOKEN")}`,
      );
      const r = j.routes?.[0];
      if (!r) throw new Error("no route");
      return { distanceKm: r.distance / 1000, durationMin: r.duration / 60, coords: toLatLng(r.geometry.coordinates) };
    }
    default: {
      const base = env("OSRM_URL") ?? "https://router.project-osrm.org";
      const j = await getJson(`${base}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`);
      const r = j.routes?.[0];
      if (!r) throw new Error("no route");
      return { distanceKm: r.distance / 1000, durationMin: r.duration / 60, coords: toLatLng(r.geometry.coordinates) };
    }
  }
}
