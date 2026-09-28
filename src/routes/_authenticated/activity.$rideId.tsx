import { createFileRoute, Link, useRouter, useCanGoBack } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Map } from "@/components/Map";
import { formatMoney, formatDateTime } from "@/lib/geo";
import { STATUS_LABEL, vehicleLabel, isSupportedType, fareBreakdown } from "@/lib/pricing";
import { ReportProblem } from "@/components/ReportProblem";

export const Route = createFileRoute("/_authenticated/activity/$rideId")({
  head: () => ({
    meta: [
      { title: "Trip details — Zoomo" },
      { name: "description", content: "Full receipt and route for your Zoomo trip." },
      { property: "og:title", content: "Trip details — Zoomo" },
      { property: "og:description", content: "Full receipt and route for your Zoomo trip." },
    ],
  }),
  component: TripDetail,
});

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-bold" : "font-medium"}>{value}</span>
    </div>
  );
}

function TripDetail() {
  const { rideId } = Route.useParams();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const { data: pricing } = useQuery({
    queryKey: ["pricing"],
    queryFn: async () => (await supabase.from("pricing_settings").select("*").eq("id", 1).maybeSingle()).data,
  });
  const { data: ride, isLoading } = useQuery({
    queryKey: ["ride", rideId],
    queryFn: async () => {
      const { data, error } = await supabase.from("rides").select("*").eq("id", rideId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-lg space-y-3 p-4">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-52 w-full rounded-2xl" />
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <p className="font-semibold">Trip not found</p>
        <Button asChild variant="outline" className="mt-3">
          <Link to="/activity">Back to trips</Link>
        </Button>
      </div>
    );
  }

  const gross = Number(ride.final_fare ?? Number(ride.fare_estimate) - Number(ride.discount));

  return (
    <div className="mx-auto max-w-lg px-4 py-4">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          to="/activity"
          onClick={(e) => {
            // Prefer real history so filters/scroll are kept
            if (canGoBack) {
              e.preventDefault();
              router.history.back();
            }
          }}
          className="inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Activity
        </Link>
        <span>/</span>
        <span className="text-foreground">Trip details</span>
      </nav>

      <div className="mt-3 h-48 overflow-hidden rounded-2xl border border-border">
        <Map
          center={{ lat: ride.pickup_lat, lng: ride.pickup_lng }}
          pickup={{ lat: ride.pickup_lat, lng: ride.pickup_lng }}
          dropoff={{ lat: ride.dropoff_lat, lng: ride.dropoff_lng }}
          route={[
            [ride.pickup_lat, ride.pickup_lng],
            [ride.dropoff_lat, ride.dropoff_lng],
          ]}
        />
      </div>

      <h1 className="mt-4 text-2xl font-bold">{formatMoney(gross)}</h1>
      <p className="text-sm text-muted-foreground">
        {STATUS_LABEL[ride.status]} · {formatDateTime(ride.created_at)}
      </p>

      <div className="mt-4 space-y-1 rounded-2xl bg-secondary p-3 text-sm">
        <p className="flex gap-2">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" /> {ride.pickup_address}
        </p>
        <p className="flex gap-2">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-foreground" /> {ride.dropoff_address}
        </p>
      </div>

      <div className="mt-4 rounded-2xl border border-border p-4">
        <p className="mb-2 font-semibold">Receipt</p>
        <Row label="Ride type" value={vehicleLabel(ride.vehicle_type)} />
        <Row label="Distance" value={`${ride.distance_km} km`} />
        {pricing && Number(ride.fare_estimate) !== Math.round(fareBreakdown(pricing, ride.vehicle_type, 0).airport) && (() => {
          const b = fareBreakdown(pricing, ride.vehicle_type, Number(ride.distance_km));
          return (
            <>
              <Row label="Base fare (first km)" value={formatMoney(b.base)} />
              {b.extraKm > 0 && (
                <Row label={`Distance (${b.extraKm.toFixed(1)} km × ${formatMoney(b.rate)})`} value={formatMoney(b.distance)} />
              )}
            </>
          );
        })()}
        <Row label="Fare estimate" value={formatMoney(ride.fare_estimate)} />
        {Number(ride.discount) > 0 && (
          <Row label={`Promo ${ride.promo_code ?? ""}`} value={`- ${formatMoney(ride.discount)}`} />
        )}
        {Number(ride.tip) > 0 && <Row label="Tip" value={formatMoney(ride.tip)} />}
        <div className="my-2 h-px bg-border" />
        <Row label="Total" value={formatMoney(gross)} strong />
        <Row label="Payment" value={ride.payment_method} />
      </div>

      {ride.status === "completed" && ride.rider_id && (
        <ReportProblem rideId={ride.id} userId={ride.rider_id} className="mt-4 w-full" />
      )}

      <Button asChild className="mt-4 h-12 w-full">
        <Link
          to="/ride"
          search={{
            pLat: ride.pickup_lat,
            pLng: ride.pickup_lng,
            pAddr: ride.pickup_address,
            dLat: ride.dropoff_lat,
            dLng: ride.dropoff_lng,
            dAddr: ride.dropoff_address,
          }}
        >
          <RotateCcw className="mr-2 h-4 w-4" /> Book again
        </Link>
      </Button>
    </div>
  );
}
