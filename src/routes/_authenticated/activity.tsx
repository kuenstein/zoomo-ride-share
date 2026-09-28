import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/Brand";
import { formatMoney } from "@/lib/geo";
import { STATUS_LABEL } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({
    meta: [
      { title: "Your trips — Zoomo" },
      { name: "description", content: "Browse your Zoomo trip history, fares and receipts." },
      { property: "og:title", content: "Your trips — Zoomo" },
      { property: "og:description", content: "Browse your Zoomo trip history, fares and receipts." },
    ],
  }),
  component: ActivityPage,
});

const FILTERS = ["all", "completed", "cancelled"] as const;

function ActivityPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");

  const { data: rides, isLoading } = useQuery({
    queryKey: ["my-rides", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .or(`rider_id.eq.${user!.id},driver_id.eq.${user!.id}`)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const filtered = (rides ?? []).filter((r) => (filter === "all" ? true : r.status === filter));

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="text-2xl font-bold">Your trips</h1>
      <div className="mt-4 flex gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            className="capitalize"
            onClick={() => setFilter(f)}
          >
            {f}
          </Button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
        {!isLoading && filtered.length === 0 && (
          <EmptyState
            title="No trips yet"
            description="Once you take a ride it will show up here with the full receipt."
            action={
              <Button asChild size="sm" className="mt-2">
                <Link to="/ride">Book a ride</Link>
              </Button>
            }
          />
        )}
        {filtered.map((r) => (
          <Link
            key={r.id}
            to="/activity/$rideId"
            params={{ rideId: r.id }}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-secondary"
          >
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-semibold">{r.dropoff_address}</p>
              <p className="truncate text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString()} · {r.distance_km} km
              </p>
              <Badge variant="secondary" className="mt-1 text-[10px]">
                {STATUS_LABEL[r.status] ?? r.status}
              </Badge>
            </div>
            <div className="text-right">
              <p className="font-bold">
                {formatMoney(r.final_fare ?? Number(r.fare_estimate) - Number(r.discount))}
              </p>
              <p className="text-[10px] capitalize text-muted-foreground">{r.payment_method}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}
