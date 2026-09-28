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
  { type: "economy", name: "Economy", description: "Affordable everyday rides", seats: 4, emoji: "🚗" },
  { type: "comfort", name: "Comfort", description: "Newer cars, more legroom", seats: 4, emoji: "🚙" },
  { type: "xl", name: "XL", description: "Van or multicab for groups", seats: 6, emoji: "🚐" },
  { type: "bike", name: "Motorcycle", description: "Habal-habal — beat the traffic, solo", seats: 1, emoji: "🏍️" },
];

export const DRIVER_VEHICLES: { type: VehicleType; name: string; emoji: string }[] = [
  { type: "tricycle", name: "Tricycle", emoji: "🛺" },
  { type: "bike", name: "Motorcycle", emoji: "🏍️" },
  { type: "economy", name: "Car", emoji: "🚗" },
  { type: "xl", name: "Van / Multicab", emoji: "🚐" },
];

export const VEHICLE_LABEL: Record<string, string> = {
  tricycle: "Tricycle",
  economy: "Economy",
  comfort: "Comfort",
  xl: "XL (Van/Multicab)",
  bike: "Motorcycle",
};

export function multiplierFor(p: Pricing, type: VehicleType): number {
  switch (type) {
    case "comfort":
      return Number(p.multiplier_comfort);
    case "xl":
      return Number(p.multiplier_xl);
    case "bike":
      return Number(p.multiplier_bike);
    case "tricycle":
      return Number(p.multiplier_tricycle);
    default:
      return Number(p.multiplier_economy);
  }
}

export function isAirportTrip(p: Pricing, a: LatLng | null, b: LatLng | null): boolean {
  const ap = { lat: Number(p.airport_lat), lng: Number(p.airport_lng) };
  const r = Number(p.airport_radius_km);
  return !!((a && haversineKm(a, ap) <= r) || (b && haversineKm(b, ap) <= r));
}

/** Mirrors the server fare: airport flat rate, else base + km + min, rounded to the nearest peso. */
export function estimateFare(p: Pricing, type: VehicleType, km: number, min: number, airport = false): number {
  const m = multiplierFor(p, type);
  if (airport) return Math.round(Number(p.airport_flat_fare) * m);
  const fare = (Number(p.base_fare) + Number(p.per_km) * km + Number(p.per_minute) * min) * m;
  return Math.round(Math.max(fare, Number(p.minimum_fare) * m));
}

export function etaFor(type: VehicleType, min: number): number {
  const factor = type === "bike" || type === "tricycle" ? 0.8 : type === "xl" ? 1.15 : 1;
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
