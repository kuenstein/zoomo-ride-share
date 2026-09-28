import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/Brand";
import { formatMoney, formatDateTime } from "@/lib/geo";
import { STATUS_LABEL } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/driver/trips")({
  head: () => ({
    meta: [
      { title: "Trip history — Zoomo Driver" },
      { name: "description", content: "Every trip you've driven with Zoomo, with fares and earnings." },
      { property: "og:title", content: "Trip history — Zoomo Driver" },
      { property: "og:description", content: "Every trip you've driven with Zoomo, with fares and earnings." },
    ],
  }),
  component: DriverTrips,
});

function DriverTrips() {
  const { user } = useAuth();
  const { data: rides, isLoading } = useQuery({
    queryKey: ["driver-trips", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const active = (rides ?? []).find((r) => ["accepted", "arriving", "in_progress"].includes(r.status));

  return (
    <div className="mx-auto max-w-lg px-4 py-4">
      <Link to="/driver" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>
      <div className="mt-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Trips</h1>
        <Button asChild variant="outline" size="sm">
          <Link to="/driver/earnings">
            <TrendingUp className="mr-1 h-4 w-4" /> Earnings
          </Link>
        </Button>
      </div>

      {active && (
        <Link
          to="/driver"
          className="mt-4 flex items-center gap-3 rounded-2xl bg-accent p-3 text-sm font-semibold text-accent-foreground"
        >
          <span className="flex-1 truncate">
            Active trip · {STATUS_LABEL[active.status]} · {active.dropoff_address}
          </span>
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}

      <div className="mt-4 space-y-2">
        {isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
        {!isLoading && (rides ?? []).length === 0 && (
          <EmptyState title="No trips yet" description="Go online from the dashboard to start receiving requests." />
        )}
        {(rides ?? []).map((r) => (
          <Link
            key={r.id}
            to="/activity/$rideId"
            params={{ rideId: r.id }}
            className="flex items-center gap-3 rounded-2xl border border-border p-3 hover:bg-secondary"
          >
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">{r.dropoff_address}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(r.created_at)} · {STATUS_LABEL[r.status]}
              </p>
            </div>
            <div className="text-right text-sm">
              <p className="font-bold">{formatMoney(r.driver_earnings ?? r.final_fare ?? r.fare_estimate)}</p>
              <p className="text-[10px] text-muted-foreground">{r.driver_earnings != null ? "earned" : "fare"}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}
