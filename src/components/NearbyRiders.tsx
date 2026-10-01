import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { vehicleLabel } from "@/lib/pricing";

function ago(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`;
}

/** Read-only, privacy-safe view of open requests near the driver (area label only). */
export function NearbyRiders() {
  const { data } = useQuery({
    queryKey: ["nearby-ride-requests"],
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("nearby_ride_requests");
      if (error) throw error;
      return data ?? [];
    },
  });
  const list = data ?? [];
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <Users className="h-4 w-4 text-accent" /> Riders in your area right now
      </h2>
      <p className="text-xs text-muted-foreground">
        For information only — take rides from "Available rides" above or from direct requests sent to you.
      </p>
      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          No riders are waiting within 5 km.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {list.map((r, i) => (
            <li key={i} className="flex items-center justify-between p-3 text-sm">
              <span>
                <span className="font-medium">{r.area}</span>
                <span className="block text-xs text-muted-foreground">
                  Wants {vehicleLabel(r.vehicle_type)}
                  {r.direct_to_me ? " · chose you" : ""}
                </span>
              </span>
              <span className="text-right text-xs text-muted-foreground">
                <span className="block font-semibold text-foreground">{r.distance_km} km</span>
                {ago(r.requested_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
