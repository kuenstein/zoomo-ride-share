import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { STATUS_LABEL } from "@/lib/pricing";

const ACTIVE = ["requested", "accepted", "arriving", "in_progress"] as const;

/** Shows a "return to your live ride" banner on rider screens while a ride is active. */
export function ActiveRideBanner() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: ride } = useQuery({
    queryKey: ["active-ride-banner", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("rides")
        .select("id,status,dropoff_address")
        .eq("rider_id", user!.id)
        .in("status", [...ACTIVE])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("active-ride-banner")
      .on("postgres_changes", { event: "*", schema: "public", table: "rides", filter: `rider_id=eq.${user.id}` }, () => {
        void qc.invalidateQueries({ queryKey: ["active-ride-banner"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user, qc]);

  if (!ride) return null;
  return (
    <Link
      to="/ride"
      className="sticky top-0 z-[400] flex items-center gap-3 bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground"
    >
      <Radio className="h-4 w-4 animate-pulse" />
      <span className="flex-1 truncate">
        {STATUS_LABEL[ride.status]} · {ride.dropoff_address}
      </span>
      <span className="flex items-center text-xs">
        View ride <ChevronRight className="h-4 w-4" />
      </span>
    </Link>
  );
}
