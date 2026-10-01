import { useQuery } from "@tanstack/react-query";
import { Loader2, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { LatLng } from "@/lib/geo";
import type { VehicleType } from "@/lib/pricing";

export type PickableDriver = {
  driver_id: string;
  full_name: string;
  avatar_url: string | null;
  rating: number;
  rating_count: number;
  vehicle: string | null;
  distance_km: number;
  approx_lat: number;
  approx_lng: number;
};

/** Online, approved drivers near a pickup. Locations are rounded (~1 km) server-side. */
export function useAvailableDrivers(pickup: LatLng | null, type: VehicleType, enabled: boolean) {
  return useQuery({
    queryKey: ["drivers-for-pickup", pickup?.lat, pickup?.lng, type],
    enabled: enabled && !!pickup,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("drivers_for_pickup", {
        _lat: pickup!.lat,
        _lng: pickup!.lng,
        _type: type,
      });
      if (error) throw error;
      return (data ?? []) as PickableDriver[];
    },
  });
}

/** ~2 min/km in town traffic, minimum 2 min. */
export const driverEta = (km: number) => Math.max(2, Math.round(km * 2.2));

export function DriverList({
  drivers,
  loading,
  selectedId,
  onSelect,
  excludeId,
}: {
  drivers: PickableDriver[] | undefined;
  loading: boolean;
  selectedId: string | null;
  onSelect: (d: PickableDriver) => void;
  excludeId?: string | null | undefined;
}) {
  const list = (drivers ?? []).filter((d) => d.driver_id !== excludeId);
  if (loading)
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Finding drivers near your pickup…
      </p>
    );
  if (list.length === 0)
    return (
      <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        No drivers of this type are online near you right now. Try "Any available driver".
      </p>
    );
  return (
    <ul className="max-h-64 space-y-2 overflow-y-auto">
      {list.map((d) => (
        <li key={d.driver_id}>
          <button
            onClick={() => onSelect(d)}
            className={`flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left ${selectedId === d.driver_id ? "border-accent bg-accent/10" : "border-border"}`}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary font-bold">
              {d.avatar_url ? <img src={d.avatar_url} alt="" className="h-full w-full object-cover" /> : d.full_name.charAt(0)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{d.full_name}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="h-3 w-3 fill-accent text-accent" /> {Number(d.rating).toFixed(2)}
                {d.vehicle ? ` · ${d.vehicle}` : ""}
              </span>
            </span>
            <span className="shrink-0 text-right text-xs">
              <span className="block font-semibold">{d.distance_km} km</span>
              <span className="text-muted-foreground">~{driverEta(d.distance_km)} min</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
