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
  { type: "economy", name: "Economy", description: "Affordable everyday rides", seats: 4, emoji: "🚗" },
  { type: "comfort", name: "Comfort", description: "Newer cars, more legroom", seats: 4, emoji: "🚙" },
  { type: "xl", name: "XL", description: "Extra space for groups", seats: 6, emoji: "🚐" },
  { type: "bike", name: "Bike", description: "Beat the traffic, solo", seats: 1, emoji: "🛵" },
];

export function multiplierFor(p: Pricing, type: VehicleType): number {
  switch (type) {
    case "comfort":
      return Number(p.multiplier_comfort);
    case "xl":
      return Number(p.multiplier_xl);
    case "bike":
      return Number(p.multiplier_bike);
    default:
      return Number(p.multiplier_economy);
  }
}

export function estimateFare(p: Pricing, type: VehicleType, km: number, min: number): number {
  const m = multiplierFor(p, type);
  const fare = (Number(p.base_fare) + Number(p.per_km) * km + Number(p.per_minute) * min) * m;
  return Math.round(Math.max(fare, Number(p.minimum_fare) * m) * 100) / 100;
}

export function etaFor(type: VehicleType, min: number): number {
  const factor = type === "bike" ? 0.8 : type === "xl" ? 1.15 : 1;
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
