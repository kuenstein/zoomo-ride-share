import { haversineKm, type LatLng } from "./geo";
import type { Database } from "@/integrations/supabase/types";

export type Pricing = Database["public"]["Tables"]["pricing_settings"]["Row"];
export type VehicleType = Database["public"]["Enums"]["vehicle_type"];

export const VEHICLE_OPTIONS: {
  type: VehicleType;
  name: string;
  description: string;
  seats: number;
  emoji: string;
}[] = [
  { type: "tricycle", name: "Tricycle", description: "Classic Dumaguete trike, up to 4", seats: 4, emoji: "🛺" },
  { type: "bike", name: "Motorcycle", description: "Habal-habal — 1 passenger, beats the traffic", seats: 1, emoji: "🏍️" },
];

export const DRIVER_VEHICLES: { type: VehicleType; name: string; emoji: string }[] = [
  { type: "tricycle", name: "Tricycle", emoji: "🛺" },
  { type: "bike", name: "Motorcycle", emoji: "🏍️" },
];

export const VEHICLE_LABEL: Record<string, string> = {
  tricycle: "Tricycle",
  bike: "Motorcycle",
};

/** Ride types Zoomo still offers. Older rows may carry retired types. */
export const SUPPORTED_TYPES = ["tricycle", "bike"] as const;
export function isSupportedType(t: string | null | undefined): boolean {
  return !!t && (SUPPORTED_TYPES as readonly string[]).includes(t);
}
/** Safe label for any stored type, including retired ones. */
export function vehicleLabel(t: string | null | undefined): string {
  return (t && VEHICLE_LABEL[t]) || "Ride (retired type)";
}

/** Per-type rates. Retired types fall back to motorcycle rates for display only. */
export function ratesFor(p: Pricing, type: string) {
  const t = type === "tricycle" ? "tricycle" : "bike";
  return {
    base: Number(p[`base_fare_${t}`]),
    perKm: Number(p[`per_km_${t}`]),
    minimum: Number(p[`minimum_fare_${t}`]),
    airport: Number(p[`airport_fare_${t}`]),
  };
}

/** Same formula as the server: max(round(base + perKm × km), minimum). */
export function fareFromRates(r: { base: number; perKm: number; minimum: number }, km: number): number {
  return Math.max(Math.round(r.base + r.perKm * km), r.minimum);
}

export function isAirportTrip(p: Pricing, a: LatLng | null, b: LatLng | null): boolean {
  const ap = { lat: Number(p.airport_lat), lng: Number(p.airport_lng) };
  const r = Number(p.airport_radius_km);
  return !!((a && haversineKm(a, ap) <= r) || (b && haversineKm(b, ap) <= r));
}

/** Mirrors the server fare: per-type airport flat fare, else base + per_km × km, rounded, never below minimum. */
export function estimateFare(p: Pricing, type: VehicleType, km: number, airport = false): number {
  const r = ratesFor(p, type);
  if (airport) return Math.round(r.airport);
  return fareFromRates(r, km);
}

/** Receipt breakdown using current pricing settings. */
export function fareBreakdown(p: Pricing, type: string, km: number) {
  const r = ratesFor(p, type);
  return { base: r.base, km, rate: r.perKm, distance: r.perKm * km, airport: r.airport };
}

export function etaFor(type: VehicleType, min: number): number {
  const factor = type === "bike" ? 0.8 : 0.9;
  return Math.max(2, Math.round(min * factor));
}

export const RIDE_STATUS_STEPS = ["accepted", "arriving", "in_progress", "completed"] as const;

export const STATUS_LABEL: Record<string, string> = {
  requested: "Finding a driver",
  accepted: "Driver accepted",
  arriving: "Driver is arriving",
  in_progress: "On the way",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
};
