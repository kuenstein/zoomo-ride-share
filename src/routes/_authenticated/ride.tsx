import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2,
  LocateFixed,
  MapPin,
  MessageSquare,
  Phone,
  Search,
  Star,
  Ticket,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Map } from "@/components/Map";
import { RideChat } from "@/components/RideChat";
import { RatingDialog } from "@/components/RatingDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DEFAULT_CENTER,
  formatMoney,
  getCurrentPosition,
  getRoute,
  reverseGeocode,
  searchAddress,
  type LatLng,
  type Place,
  type RouteResult,
} from "@/lib/geo";
import { VEHICLE_OPTIONS, VEHICLE_LABEL, vehicleLabel, estimateFare, etaFor, isAirportTrip, STATUS_LABEL, type VehicleType } from "@/lib/pricing";
import { POPULAR_PLACES, type ServiceArea } from "@/lib/places";
import { haversineKm } from "@/lib/geo";
import { TripAssistant } from "@/components/TripAssistant";
import type { Database } from "@/integrations/supabase/types";

type Ride = Database["public"]["Tables"]["rides"]["Row"];
type PaymentMethod = Database["public"]["Enums"]["payment_method"];

const ACTIVE_STATUSES = ["requested", "accepted", "arriving", "in_progress"] as const;

type RideSearch = {
  pLat?: number | undefined;
  pLng?: number | undefined;
  pAddr?: string | undefined;
  dLat?: number | undefined;
  dLng?: number | undefined;
  dAddr?: string | undefined;
  promo?: string | undefined;
};

const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v !== "" && !isNaN(+v) ? +v : undefined);
const str = (v: unknown) => (typeof v === "string" && v ? v.slice(0, 300) : undefined);

export const Route = createFileRoute("/_authenticated/ride")({
  validateSearch: (s: Record<string, unknown>): RideSearch => ({
    pLat: num(s["pLat"]),
    pLng: num(s["pLng"]),
    pAddr: str(s["pAddr"]),
    dLat: num(s["dLat"]),
    dLng: num(s["dLng"]),
    dAddr: str(s["dAddr"]),
    promo: str(s["promo"])?.toUpperCase(),
  }),
  head: () => ({
    meta: [
      { title: "Book a ride — Zoomo" },
      { name: "description", content: "Set your pickup and destination and get matched with a nearby Zoomo driver." },
      { property: "og:title", content: "Book a ride — Zoomo" },
      { property: "og:description", content: "Set your pickup and destination and get matched with a nearby Zoomo driver." },
    ],
  }),
  component: RidePage,
});

function AddressField({
  label,
  value,
  onPick,
  accent,
}: {
  label: string;
  value: string;
  onPick: (p: Place) => void;
  accent?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || query.trim().length < 3) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      setLoading(true);
      void searchAddress(query)
        .then(setResults)
        .finally(() => setLoading(false));
    }, 450);
    return () => clearTimeout(t);
  }, [query, open]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${accent ? "bg-accent" : "bg-foreground"}`}
        />
        <input
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder={label}
          value={open ? query : value}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onChange={(e) => setQuery(e.target.value)}
        />
        {open ? (
          <button onClick={() => setOpen(false)} aria-label="Close search">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        ) : (
          <Search className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      {open && (query.length > 0 || results.length > 0) && (
        <div className="absolute inset-x-0 top-12 z-20 max-h-56 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg">
          {loading && <p className="p-3 text-sm text-muted-foreground">Searching…</p>}
          {!loading && results.length === 0 && query.length >= 3 && (
            <p className="p-3 text-sm text-muted-foreground">No matches found.</p>
          )}
          {results.map((r) => (
            <button
              key={`${r.lat}-${r.lng}-${r.address}`}
              className="flex w-full items-start gap-2 rounded-lg p-2 text-left text-sm hover:bg-secondary"
              onClick={() => {
                onPick(r);
                setOpen(false);
              }}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span className="line-clamp-2">{r.address}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RidePage() {
  const { user, profile } = useAuth();
  const search = Route.useSearch();
  const prefillPickup =
    search.pLat != null && search.pLng != null
      ? { lat: search.pLat, lng: search.pLng, address: search.pAddr ?? "Pickup" }
      : null;
  const [pickup, setPickup] = useState<Place | null>(prefillPickup);
  const [dropoff, setDropoff] = useState<Place | null>(
    search.dLat != null && search.dLng != null
      ? { lat: search.dLat, lng: search.dLng, address: search.dAddr ?? "Destination" }
      : null,
  );
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [vehicle, setVehicle] = useState<VehicleType>("tricycle");
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [promo, setPromo] = useState(search.promo ?? "");
  const [promoInfo, setPromoInfo] = useState<{ valid: boolean; discount: number; message: string } | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [driverPos, setDriverPos] = useState<LatLng | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [finishedRide, setFinishedRide] = useState<Ride | null>(null);
  const [rateOpen, setRateOpen] = useState(false);
  const [locating, setLocating] = useState(true);

  const { data: pricing } = useQuery({
    queryKey: ["pricing"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pricing_settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: areas } = useQuery({
    queryKey: ["service-areas"],
    queryFn: async () => {
      const { data } = await supabase.from("service_areas").select("*").eq("active", true).order("name");
      return (data ?? []) as ServiceArea[];
    },
  });
  const inArea = useCallback(
    (p: LatLng | null) =>
      !p || !areas || areas.length === 0 ||
      areas.some((a) => haversineKm(p, { lat: a.center_lat, lng: a.center_lng }) <= Number(a.radius_km)),
    [areas],
  );
  const areaNames = (areas ?? []).map((a) => a.name).join(", ");
  const outsideArea = !inArea(pickup) || !inArea(dropoff);
  const airport = pricing ? isAirportTrip(pricing, pickup, dropoff) : false;

  const { data: savedPlaces } = useQuery({
    queryKey: ["saved-places", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("saved_places").select("*").order("created_at");
      return data ?? [];
    },
  });

  // Initial geolocation
  useEffect(() => {
    if (prefillPickup) {
      setLocating(false);
      return;
    }
    void (async () => {
      try {
        const pos = await getCurrentPosition();
        const address = await reverseGeocode(pos);
        setPickup({ ...pos, address });
      } catch {
        const address = await reverseGeocode(DEFAULT_CENTER);
        setPickup({ ...DEFAULT_CENTER, address });
        toast.message("Using a default pickup", {
          description: "Allow location access or drag the pin to set your exact pickup.",
        });
      } finally {
        setLocating(false);
      }
    })();
  }, []);

  // Load + subscribe to my rides
  const loadActive = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("rides")
      .select("*")
      .eq("rider_id", user.id)
      .in("status", [...ACTIVE_STATUSES])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveRide(data ?? null);
  }, [user]);

  useEffect(() => {
    void loadActive();
    if (!user) return;
    const channel = supabase
      .channel("rider-rides")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rides", filter: `rider_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as Ride;
          if (!row) return;
          if ((ACTIVE_STATUSES as readonly string[]).includes(row.status)) {
            setActiveRide(row);
          } else {
            setActiveRide(null);
            if (row.status === "completed") {
              setFinishedRide(row);
              setRateOpen(true);
            }
            if (row.status === "expired") {
              toast.error("No drivers responded. Try again.");
            }
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, loadActive]);

  // Driver live location
  useEffect(() => {
    const driverId = activeRide?.driver_id;
    if (!driverId) {
      setDriverPos(null);
      return;
    }
    void (async () => {
      const { data } = await supabase
        .from("driver_locations")
        .select("lat,lng")
        .eq("driver_id", driverId)
        .maybeSingle();
      if (data) setDriverPos({ lat: data.lat, lng: data.lng });
    })();
    const channel = supabase
      .channel(`driver-pos-${driverId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_locations", filter: `driver_id=eq.${driverId}` },
        (payload) => {
          const row = payload.new as { lat: number; lng: number };
          if (row) setDriverPos({ lat: row.lat, lng: row.lng });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeRide?.driver_id]);

  // Driver details
  const { data: driverInfo } = useQuery({
    queryKey: ["driver-info", activeRide?.driver_id],
    enabled: !!activeRide?.driver_id,
    queryFn: async () => {
      const id = activeRide!.driver_id!;
      const [p, d] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("drivers").select("id,total_trips").eq("user_id", id).maybeSingle(),
      ]);
      let vehicleRow = null;
      if (d.data) {
        const v = await supabase.from("vehicles").select("*").eq("driver_id", d.data.id).maybeSingle();
        vehicleRow = v.data;
      }
      return { profile: p.data, vehicle: vehicleRow, trips: d.data?.total_trips ?? 0 };
    },
  });

  // Route calculation
  useEffect(() => {
    if (!pickup || !dropoff) {
      setRoute(null);
      return;
    }
    let cancelled = false;
    void getRoute(pickup, dropoff).then((r) => {
      if (!cancelled) setRoute(r);
    });
    return () => {
      cancelled = true;
    };
  }, [pickup, dropoff]);

  // Expire stale requests so riders aren't stuck
  useEffect(() => {
    if (activeRide?.status !== "requested") return;
    const t = setInterval(() => {
      void supabase.rpc("expire_stale_rides");
    }, 20000);
    return () => clearInterval(t);
  }, [activeRide?.status]);

  const baseFare = useMemo(() => {
    if (!pricing || !route) return null;
    return estimateFare(pricing, vehicle, route.distanceKm, airport);
  }, [pricing, route, vehicle, airport]);

  const applyPromo = async () => {
    if (!promo.trim() || !baseFare) return;
    const { data, error } = await supabase.rpc("validate_promo", {
      _code: promo.trim(),
      _amount: baseFare,
    });
    if (error) {
      toast.error("Could not check that code");
      return;
    }
    const res = data as unknown as { valid: boolean; discount?: number; message: string };
    setPromoInfo({ valid: res.valid, discount: Number(res.discount ?? 0), message: res.message });
    if (res.valid) toast.success(`${res.message} — ${formatMoney(res.discount)} off`);
    else toast.error(res.message);
  };

  const requestRide = async () => {
    if (!user || !pickup || !dropoff || !route) return;
    if (outsideArea) {
      toast.error("Zoomo isn't available there yet", { description: `We currently serve ${areaNames}.` });
      return;
    }
    setRequesting(true);
    const { data, error } = await supabase
      .from("rides")
      .insert({
        rider_id: user.id,
        vehicle_type: vehicle,
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        pickup_address: pickup.address,
        dropoff_lat: dropoff.lat,
        dropoff_lng: dropoff.lng,
        dropoff_address: dropoff.address,
        distance_km: route.distanceKm,
        duration_min: route.durationMin,
        payment_method: payment,
        promo_code: promoInfo?.valid ? promo.trim().toUpperCase() : null,
      })
      .select()
      .single();
    setRequesting(false);
    if (error) {
      toast.error(error.message.includes("not yet available") ? "Zoomo isn't available there yet" : "Could not request your ride");
      return;
    }
    setActiveRide(data);
    toast.success("Looking for a nearby driver…");
  };

  const cancelRide = async () => {
    if (!activeRide) return;
    const { error } = await supabase
      .from("rides")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: "Cancelled by rider" })
      .eq("id", activeRide.id);
    if (error) {
      toast.error("Could not cancel");
      return;
    }
    setActiveRide(null);
    toast.success("Ride cancelled");
  };

  const mapCenter = driverPos ?? pickup ?? DEFAULT_CENTER;
  const netFare = baseFare != null ? Math.max(baseFare - (promoInfo?.valid ? promoInfo.discount : 0), 0) : null;

  return (
    <div className="relative h-[100dvh] overflow-hidden">
      <div className="absolute inset-0">
        <Map
          center={mapCenter}
          pickup={activeRide ? { lat: activeRide.pickup_lat, lng: activeRide.pickup_lng } : pickup}
          dropoff={activeRide ? { lat: activeRide.dropoff_lat, lng: activeRide.dropoff_lng } : dropoff}
          driver={driverPos}
          route={route?.coords ?? []}
          draggablePickup={!activeRide}
          onPickupMove={(p) => {
            void reverseGeocode(p).then((address) => setPickup({ ...p, address }));
          }}
        />
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4">
        <div className="pointer-events-auto rounded-full bg-card/90 px-3 py-1.5 shadow backdrop-blur">
          <Logo className="text-sm" />
        </div>
        <div className="pointer-events-auto rounded-full bg-card/90 shadow backdrop-blur">
          <ThemeToggle />
        </div>
      </header>

      <div className="absolute inset-x-0 bottom-0 z-10 max-h-[78vh] overflow-y-auto zoomo-sheet p-4 pb-6 transition-all duration-300">
        {receiptId && !activeRide && (
          <div className="mb-4 rounded-2xl border border-accent/40 bg-accent/10 p-4">
            <p className="font-semibold">Salamat! Thanks for riding with Zoomo.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => { setReceiptId(null); setDropoff(null); }}>
                Back to home
              </Button>
              <Button asChild>
                <Link to="/activity/$rideId" params={{ rideId: receiptId }}>View receipt</Link>
              </Button>
            </div>
          </div>
        )}
        {activeRide ? (
          <TrackingPanel
            ride={activeRide}
            driverInfo={driverInfo ?? null}
            onCancel={cancelRide}
            onToggleChat={() => setShowChat((s) => !s)}
            showChat={showChat}
            userId={user?.id ?? ""}
          />
        ) : (
          <div className="space-y-4">
            <div className="mx-auto h-1 w-10 rounded-full bg-border" />
            <h1 className="text-xl font-bold">
              Where to{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}?
            </h1>

            <div className="space-y-2">
              {locating ? (
                <Skeleton className="h-10 w-full rounded-xl" />
              ) : (
                <AddressField
                  label="Pickup location"
                  value={pickup?.address ?? ""}
                  accent
                  onPick={(p) => setPickup(p)}
                />
              )}
              <AddressField label="Where to?" value={dropoff?.address ?? ""} onPick={(p) => setDropoff(p)} />
              <TripAssistant
                savedPlaces={(savedPlaces ?? []).map((s) => s.label)}
                onApply={async (s) => {
                  setVehicle(s.vehicle);
                  if (s.payment) setPayment(s.payment);
                  const name = s.destination_name?.toLowerCase();
                  const known =
                    name &&
                    (POPULAR_PLACES.find((p) => p.name.toLowerCase() === name) ??
                      (savedPlaces ?? []).find((p) => p.label.toLowerCase() === name));
                  if (known) {
                    setDropoff({ lat: known.lat, lng: known.lng, address: known.address });
                  } else if (s.destination_query || s.destination_name) {
                    const found = await searchAddress(s.destination_query ?? s.destination_name ?? "");
                    if (found[0]) setDropoff(found[0]);
                    else toast.message("Couldn't find that destination — please pick it above.");
                  }
                  toast.success(`${VEHICLE_LABEL[s.vehicle]} selected`);
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const pos = await getCurrentPosition();
                      setPickup({ ...pos, address: await reverseGeocode(pos) });
                      toast.success("Pickup set to your location");
                    } catch {
                      toast.error("Location permission denied");
                    }
                  }}
                >
                  <LocateFixed className="mr-1 h-3.5 w-3.5" /> Current location
                </Button>
                {(savedPlaces ?? []).length === 0 && (
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/places">
                      <MapPin className="mr-1 h-3.5 w-3.5" /> Add Home / Work
                    </Link>
                  </Button>
                )}
                {(savedPlaces ?? []).length > 0 && (
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/places">Edit places</Link>
                  </Button>
                )}
                {(savedPlaces ?? []).map((sp) => (
                  <Button
                    key={sp.id}
                    size="sm"
                    variant="secondary"
                    onClick={() => setDropoff({ lat: sp.lat, lng: sp.lng, address: sp.address })}
                  >
                    {sp.label}
                  </Button>
                ))}
              </div>
              <div className="-mx-4 overflow-x-auto px-4">
                <div className="flex w-max gap-2 pb-1">
                  {POPULAR_PLACES.map((pl) => (
                    <button
                      key={pl.name}
                      onClick={() => setDropoff(pl)}
                      className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs hover:bg-secondary"
                    >
                      <MapPin className="h-3 w-3 text-accent" /> {pl.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {outsideArea && (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <p className="font-semibold">Pasensya! Zoomo isn't available there yet.</p>
                <p className="text-xs text-muted-foreground">
                  We currently serve {areaNames || "Dumaguete City, Bacong, Sibulan and Valencia"}. Pick a pickup and
                  destination inside these areas.
                </p>
              </div>
            )}
            {airport && route && (
              <p className="rounded-xl bg-accent/10 p-2 text-xs">✈️ Airport trip — flat rate applies.</p>
            )}

            {pickup && dropoff && !route && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Calculating best route…
              </div>
            )}

            {route && pricing && !outsideArea && (
              <>
                <div className="space-y-2">
                  {VEHICLE_OPTIONS.map((opt) => {
                    const fare = estimateFare(pricing, opt.type, route.distanceKm, airport);
                    const selected = vehicle === opt.type;
                    return (
                      <button
                        key={opt.type}
                        onClick={() => setVehicle(opt.type)}
                        className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${
                          selected ? "border-accent bg-accent/10" : "border-border"
                        }`}
                      >
                        <span className="text-2xl">{opt.emoji}</span>
                        <span className="flex-1">
                          <span className="block text-sm font-semibold">
                            {opt.name} · {opt.seats} seat{opt.seats > 1 ? "s" : ""}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {route.distanceKm} km · ~{etaFor(opt.type, route.durationMin)} min ETA · {opt.description}
                          </span>
                        </span>
                        <span className="text-sm font-bold">{formatMoney(fare)}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-muted-foreground">Payment</span>
                  <Link to="/wallet" className="font-medium text-accent">Top up wallet</Link>
                </div>
                <div className="flex gap-2">
                  {(["cash", "card", "wallet"] as PaymentMethod[]).map((pm) => (
                    <Button
                      key={pm}
                      variant={payment === pm ? "default" : "outline"}
                      size="sm"
                      className="flex-1 capitalize"
                      onClick={() => setPayment(pm)}
                    >
                      {pm}
                    </Button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <div className="flex flex-1 items-center gap-2 rounded-xl border border-border px-3">
                    <Ticket className="h-4 w-4 text-accent" />
                    <Input
                      className="border-0 px-0 shadow-none focus-visible:ring-0"
                      placeholder="Promo code"
                      value={promo}
                      onChange={(e) => {
                        setPromo(e.target.value.toUpperCase());
                        setPromoInfo(null);
                      }}
                    />
                  </div>
                  <Button variant="outline" onClick={applyPromo} disabled={!promo.trim()}>
                    Apply
                  </Button>
                </div>
                {promoInfo && (
                  <p className={`text-xs ${promoInfo.valid ? "text-accent" : "text-destructive"}`}>
                    {promoInfo.message}
                  </p>
                )}

                <Button className="h-12 w-full text-base" onClick={requestRide} disabled={requesting}>
                  {requesting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>Request {VEHICLE_OPTIONS.find((v) => v.type === vehicle)?.name} · {formatMoney(netFare)}</>
                  )}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {finishedRide && user && (
        <RatingDialog
          open={rateOpen}
          onOpenChange={setRateOpen}
          rideId={finishedRide.id}
          raterId={user.id}
          rateeId={finishedRide.driver_id ?? user.id}
          title={`Trip complete — ${formatMoney(finishedRide.final_fare)}`}
          allowTip
          onDone={() => {
            setReceiptId(finishedRide.id);
            setFinishedRide(null);
          }}
        />
      )}
    </div>
  );
}

function TrackingPanel({
  ride,
  driverInfo,
  onCancel,
  onToggleChat,
  showChat,
  userId,
}: {
  ride: Ride;
  driverInfo?: { profile: { full_name: string; rating: number; avatar_url: string | null } | null; vehicle: { make: string; model: string; color: string; plate: string } | null; trips: number } | null;
  onCancel: () => void;
  onToggleChat: () => void;
  showChat: boolean;
  userId: string;
}) {
  const steps = ["accepted", "arriving", "in_progress", "completed"] as const;
  const currentIndex = steps.indexOf(ride.status as (typeof steps)[number]);

  return (
    <div className="space-y-4">
      <div className="mx-auto h-1 w-10 rounded-full bg-border" />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-bold">{STATUS_LABEL[ride.status]}</p>
          <p className="text-xs text-muted-foreground">
            {ride.distance_km} km · {formatMoney(Number(ride.fare_estimate) - Number(ride.discount))} ·{" "}
            {ride.payment_method}
          </p>
        </div>
        <Badge variant="secondary">
          {vehicleLabel(ride.vehicle_type)}
        </Badge>
      </div>

      {ride.status === "requested" ? (
        <div className="flex items-center gap-3 rounded-2xl border border-border p-4">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          <div className="flex-1">
            <p className="text-sm font-medium">Finding you a driver nearby…</p>
            <p className="text-xs text-muted-foreground">We notify drivers within 5 km first.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-2xl border border-border p-3">
            <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-secondary text-lg font-bold">
              {driverInfo?.profile?.avatar_url ? (
                <img src={driverInfo.profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                (driverInfo?.profile?.full_name ?? "D").charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold">{driverInfo?.profile?.full_name ?? "Your driver"}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="h-3 w-3 fill-accent text-accent" />
                {Number(driverInfo?.profile?.rating ?? 5).toFixed(2)} · {driverInfo?.trips ?? 0} trips
              </p>
              {driverInfo?.vehicle && (
                <p className="text-xs text-muted-foreground">
                  {driverInfo.vehicle.color} {driverInfo.vehicle.make} {driverInfo.vehicle.model} ·{" "}
                  <span className="font-semibold text-foreground">{driverInfo.vehicle.plate}</span>
                </p>
              )}
            </div>
            <Button size="icon" variant="outline" onClick={onToggleChat} aria-label="Chat with driver">
              <MessageSquare className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" aria-label="Call driver" asChild>
              <a href="tel:">
                <Phone className="h-4 w-4" />
              </a>
            </Button>
          </div>

          <div className="flex items-center gap-1">
            {steps.map((s, i) => (
              <div key={s} className="flex-1">
                <div className={`h-1.5 rounded-full ${i <= currentIndex ? "bg-accent" : "bg-border"}`} />
                <p className="mt-1 text-[10px] capitalize text-muted-foreground">{s.replace("_", " ")}</p>
              </div>
            ))}
          </div>

          {showChat && <RideChat rideId={ride.id} userId={userId} />}
        </>
      )}

      <div className="space-y-1 rounded-2xl bg-secondary p-3 text-sm">
        <p className="flex gap-2">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
          <span className="line-clamp-1">{ride.pickup_address}</span>
        </p>
        <p className="flex gap-2">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-foreground" />
          <span className="line-clamp-1">{ride.dropoff_address}</span>
        </p>
      </div>

      {ride.status !== "in_progress" && (
        <Button variant="outline" className="w-full" onClick={onCancel}>
          Cancel ride
        </Button>
      )}
    </div>
  );
}
