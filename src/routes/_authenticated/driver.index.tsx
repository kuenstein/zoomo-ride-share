import { useCallback, useEffect, useRef, useState } from "react";
import { DriverDocuments, DOC_TYPES, useDriverDocs } from "@/components/DriverDocuments";
import { SosButton } from "@/components/SosButton";
import { RideBoard } from "@/components/RideBoard";
import { NearbyRiders } from "@/components/NearbyRiders";
import { unlockAudio, useWakeLock } from "@/lib/alerts";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { setStoredMode } from "@/lib/nav";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Loader2, MessageSquare, Navigation, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Map } from "@/components/Map";
import { RideChat, isChatOpen } from "@/components/RideChat";
import { RatingDialog } from "@/components/RatingDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Logo } from "@/components/Brand";
import {
  DEFAULT_CENTER,
  formatMoney,
  getPositionFix,
  isPlausibleForServiceArea,
  haversineKm,
  type LatLng,
} from "@/lib/geo";
import { DRIVER_VEHICLES, VEHICLE_OPTIONS, STATUS_LABEL, isSupportedType, type VehicleType } from "@/lib/pricing";
import type { Database } from "@/integrations/supabase/types";

type Ride = Database["public"]["Tables"]["rides"]["Row"];

const ACTIVE = ["accepted", "arriving", "in_progress"] as const;

export const Route = createFileRoute("/_authenticated/driver/")({
  head: () => ({
    meta: [
      { title: "Drive — Zoomo" },
      { name: "description", content: "Go online, accept nearby ride requests and track your earnings." },
      { property: "og:title", content: "Drive — Zoomo" },
      { property: "og:description", content: "Go online, accept nearby ride requests and track your earnings." },
    ],
  }),
  component: DriverPage,
});

function DriverPage() {
  const { user, driver, refresh, isDriver } = useAuth();

  if (!user) return null;
  if (!isDriver || !driver) return <Onboarding onDone={refresh} />;
  if (driver.status === "pending")
    return (
      <StatusScreen
        title="Application under review"
        text="An admin is reviewing your documents. You'll be able to go online as soon as you're approved."
        userId={user.id}
      />
    );
  if (driver.status === "rejected")
    return (
      <StatusScreen
        title="Application not approved"
        text={driver.rejection_reason ?? "Fix the documents below, then contact support to be reviewed again."}
        userId={user.id}
      />
    );
  if (driver.status === "suspended")
    return <StatusScreen title="Account suspended" text="Reach out to Zoomo support to restore access." />;

  return <DriverHome />;
}

function StatusScreen({ title, text, userId }: { title: string; text: string; userId?: string }) {
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-16 text-center">
      <Clock className="h-10 w-10 text-accent" />
      <h1 className="mt-4 text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
      {userId && (
        <div className="mt-6 w-full text-left">
          <p className="mb-2 text-sm font-semibold">Your documents</p>
          <DriverDocuments userId={userId} />
        </div>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild variant="outline">
          <Link to="/account">Go to account</Link>
        </Button>
        <Button onClick={() => { setStoredMode("rider"); void navigate({ to: "/ride" }); }}>
          Switch to rider mode
        </Button>
      </div>
    </div>
  );
}

function Onboarding({ onDone }: { onDone: () => Promise<void> }) {
  const { user } = useAuth();
  const [license, setLicense] = useState("");
  const [expiry, setExpiry] = useState("");
  const [type, setType] = useState<VehicleType>("tricycle");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [plate, setPlate] = useState("");
  const [orcr, setOrcr] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: docs } = useDriverDocs(user?.id);
  const docsDone = DOC_TYPES.every((d) => docs?.some((x) => x.doc_type === d.type));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!docsDone) {
      toast.error("Upload all four documents first");
      return;
    }
    setBusy(true);
    try {
      await supabase.from("user_roles").insert({ user_id: user.id, role: "driver" });
      const { data: d, error } = await supabase
        .from("drivers")
        .insert({ user_id: user.id, license_number: license, license_expiry: expiry || null })
        .select()
        .single();
      if (error) throw error;
      const { error: vErr } = await supabase
        .from("vehicles")
        .insert({ driver_id: d.id, type, make, model, color, plate, or_cr_number: orcr });
      if (vErr) throw vErr;
      toast.success("Application submitted for review");
      await onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit application");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <Logo className="text-lg" />
      <h1 className="mt-4 text-2xl font-bold">Become a Zoomo driver</h1>
      <p className="text-sm text-muted-foreground">Tell us about you and your vehicle. Approval is manual.</p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="lic">LTO driver's license number</Label>
          <Input id="lic" value={license} onChange={(e) => setLicense(e.target.value.toUpperCase())} placeholder="e.g. G12-34-567890" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exp">License expiry date</Label>
          <Input id="exp" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Vehicle type</Label>
          <div className="grid grid-cols-2 gap-2">
            {DRIVER_VEHICLES.map((v) => (
              <button
                key={v.type}
                type="button"
                onClick={() => setType(v.type)}
                className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                  type === v.type ? "border-accent bg-accent/10" : "border-border"
                }`}
              >
                <span className="mr-2">{v.emoji}</span>
                {v.name}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="mk">Make</Label>
            <Input id="mk" value={make} onChange={(e) => setMake(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="md">Model</Label>
            <Input id="md" value={model} onChange={(e) => setModel(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cl">Color</Label>
            <Input id="cl" value={color} onChange={(e) => setColor(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pl">Plate number (per OR/CR)</Label>
            <Input id="pl" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="orcr">OR/CR number</Label>
          <Input id="orcr" value={orcr} onChange={(e) => setOrcr(e.target.value.toUpperCase())} placeholder="Official Receipt / Certificate of Registration no." required />
        </div>
        <div className="space-y-2">
          <Label>Documents (photo or PDF, under 5 MB)</Label>
          {user && <DriverDocuments userId={user.id} />}
        </div>
        <Button type="submit" className="w-full" disabled={busy || !docsDone}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : docsDone ? "Submit application" : "Upload all 4 documents to submit"}
        </Button>
      </form>
    </div>
  );
}

function DriverHome() {
  const { user, driver, refresh, profile } = useAuth();
  const [online, setOnline] = useState(driver?.is_online ?? false);
  const [pos, setPos] = useState<LatLng | null>(null);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rateRide, setRateRide] = useState<Ride | null>(null);
  const [vehicle, setVehicle] = useState<{ id: string; type: VehicleType } | null>(null);
  useEffect(() => {
    if (!driver) return;
    void supabase.from("vehicles").select("id,type").eq("driver_id", driver.id).order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setVehicle(data));
  }, [driver]);
  const vehicleOk = !vehicle || isSupportedType(vehicle.type);
  const fixVehicle = async (t: VehicleType) => {
    if (!vehicle) return;
    const { error } = await supabase.from("vehicles").update({ type: t }).eq("id", vehicle.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setVehicle({ ...vehicle, type: t });
    toast.success("Vehicle type updated — you can go online now");
  };

  const [locDenied, setLocDenied] = useState(false);
  const [locStale, setLocStale] = useState(false);
  const realFix = useRef(false);

  // Location broadcasting
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const push = async () => {
      try {
        const p = await getPositionFix();
        if (cancelled) return;
        setLocDenied(false);
        // Reject coarse/IP-based fixes far from Dumaguete; keep the saved location.
        if (!isPlausibleForServiceArea(p.lat, p.lng, p.accuracy)) {
          setLocStale(true);
          if (!pos) setPos(DEFAULT_CENTER);
          return;
        }
        setLocStale(false);
        setPos({ lat: p.lat, lng: p.lng });
        // First real GPS fix replaces the Dumaguete default even while offline
        if (online || !realFix.current) {
          await supabase
            .from("driver_locations")
            .upsert({ driver_id: user.id, lat: p.lat, lng: p.lng, is_online: online, updated_at: new Date().toISOString() });
        }
        realFix.current = true;
      } catch (err) {
        if (cancelled) return;
        const code = (err as { code?: number } | null)?.code;
        if (code === 1) setLocDenied(true);
        else if (navigator.permissions) {
          try {
            const s = await navigator.permissions.query({ name: "geolocation" as PermissionName });
            setLocDenied(s.state === "denied");
          } catch { /* ignore */ }
        }
        if (!pos) setPos(DEFAULT_CENTER);
      }
    };
    void push();
    const t = setInterval(() => void push(), 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, online]);

  useWakeLock(online);
  const licenseExpired = !!driver?.license_expiry && driver.license_expiry < new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  const toggleOnline = async (next: boolean) => {
    if (!user) return;
    if (next) unlockAudio();
    if (next && licenseExpired) {
      toast.error("Your driver's license has expired");
      return;
    }
    if (next && !vehicleOk) {
      toast.error("Update your vehicle type to Tricycle or Motorcycle first");
      return;
    }
    const { error: onlineErr } = await supabase.from("drivers").update({ is_online: next }).eq("user_id", user.id);
    if (onlineErr) {
      toast.error(onlineErr.message.includes("owe Zoomo") ? "Please settle what you owe Zoomo to go online" : "Could not change your status");
      return;
    }
    setOnline(next);
    if (realFix.current && pos && isPlausibleForServiceArea(pos.lat, pos.lng)) {
      await supabase
        .from("driver_locations")
        .upsert({ driver_id: user.id, lat: pos.lat, lng: pos.lng, is_online: next, updated_at: new Date().toISOString() });
    } else {
      // No trusted fix yet: keep whatever location is saved, only flip online state.
      await supabase
        .from("driver_locations")
        .update({ is_online: next, updated_at: new Date().toISOString() })
        .eq("driver_id", user.id);
    }
    toast.success(next ? "You're online — requests incoming" : "You're offline");
    await refresh();
  };

  const loadActive = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("rides")
      .select("*")
      .eq("driver_id", user.id)
      .in("status", [...ACTIVE])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveRide(data ?? null);
  }, [user]);

  useEffect(() => {
    void loadActive();
  }, [loadActive]);

  // Keep own active ride in sync
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("driver-own-rides")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rides", filter: `driver_id=eq.${user.id}` }, (payload) => {
        const r = payload.new as Ride;
        if ((ACTIVE as readonly string[]).includes(r.status)) setActiveRide(r);
        else setActiveRide((cur) => (cur?.id === r.id ? null : cur));
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user]);

  const setStatus = async (status: "arriving" | "in_progress") => {
    if (!activeRide) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("driver_set_ride_status", { _ride_id: activeRide.id, _status: status });
    setBusy(false);
    const res = data as unknown as { success: boolean; message?: string } | null;
    if (error || !res?.success) {
      toast.error(res?.message ?? "Could not update the trip");
      return;
    }
    toast.success(status === "arriving" ? "Marked as arrived" : "Trip started");
    await loadActive();
  };

  const complete = async () => {
    if (!activeRide) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("complete_ride", { _ride_id: activeRide.id, _tip: 0 });
    setBusy(false);
    const res = data as unknown as { success: boolean; message?: string; earnings?: number; cash?: boolean; fare?: number } | null;
    if (error || !res?.success) {
      toast.error(res?.message ?? "Could not complete the trip");
      return;
    }
    toast.success(
      res.cash
        ? `Trip complete — collect ${formatMoney(res.fare)} in cash. You earned ${formatMoney(res.earnings)}`
        : `Trip complete — you earned ${formatMoney(res.earnings)}`,
    );
    setRateRide(activeRide);
    setActiveRide(null);
    void refetchWallet();
  };

  const cancelTrip = async () => {
    if (!activeRide) return;
    const { data, error } = await supabase.rpc("driver_set_ride_status", { _ride_id: activeRide.id, _status: "cancelled" });
    const res = data as unknown as { success: boolean; message?: string } | null;
    if (error || !res?.success) {
      toast.error(res?.message ?? "Could not cancel this trip");
      return;
    }
    setActiveRide(null);
    toast.success("Trip cancelled");
  };

  const { data: walletInfo, refetch: refetchWallet } = useQuery({
    queryKey: ["driver-wallet", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [w, p] = await Promise.all([
        supabase.from("wallets").select("balance").eq("user_id", user!.id).maybeSingle(),
        supabase.from("pricing_settings").select("max_driver_debt").eq("id", 1).maybeSingle(),
      ]);
      const balance = Number(w.data?.balance ?? 0);
      const limit = Number(p.data?.max_driver_debt ?? 500);
      return { balance, limit, blocked: balance < -limit };
    },
  });

  const { data: todayEarnings } = useQuery({
    queryKey: ["driver-today", user?.id, activeRide?.id],
    enabled: !!user,
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("rides")
        .select("driver_earnings")
        .eq("driver_id", user!.id)
        .eq("status", "completed")
        .gte("completed_at", start.toISOString());
      return (data ?? []).reduce((s, r) => s + Number(r.driver_earnings), 0);
    },
  });

  const target = activeRide
    ? activeRide.status === "in_progress"
      ? { lat: activeRide.dropoff_lat, lng: activeRide.dropoff_lng }
      : { lat: activeRide.pickup_lat, lng: activeRide.pickup_lng }
    : null;

  return (
    <div className="relative h-[100dvh] overflow-hidden">
      <div className="absolute inset-0">
        <Map
          center={pos ?? DEFAULT_CENTER}
          driver={pos}
          pickup={activeRide ? { lat: activeRide.pickup_lat, lng: activeRide.pickup_lng } : null}
          dropoff={activeRide ? { lat: activeRide.dropoff_lat, lng: activeRide.dropoff_lng } : null}
        />
      </div>

      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4">
        <div className="rounded-full bg-card/90 px-3 py-1.5 shadow backdrop-blur">
          <Logo className="text-sm" />
        </div>
        <div className="flex items-center gap-2 rounded-full bg-card/90 px-3 py-2 shadow backdrop-blur">
          <span className="text-xs font-semibold">{online ? "Online" : "Offline"}</span>
          <Switch checked={online} onCheckedChange={toggleOnline} aria-label="Go online" />
        </div>
      </header>

      <div className="absolute inset-x-0 bottom-0 z-10 max-h-[78vh] overflow-y-auto zoomo-sheet p-4 pb-6">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
        {locDenied && (
          <div className="mb-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <p className="font-semibold">Turn on location to get accurate ride requests</p>
            <p className="text-muted-foreground">
              Zoomo is showing you at Dumaguete City center for now. Riders are matched by where you really are, so allow location access for this site in your browser settings, then reload the page.
            </p>
          </div>
        )}
        {locStale && !locDenied && (
          <div className="mb-3 rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm">
            <p className="font-semibold">Location looks inaccurate</p>
            <p className="text-muted-foreground">
              We couldn't get an accurate location for you (got a fix far outside Dumaguete). Move somewhere with a clearer GPS signal, or enable precise/high-accuracy location in your browser/phone settings.
            </p>
          </div>
        )}
        {licenseExpired && (
          <div className="mb-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <p className="font-semibold">Your driver's license has expired</p>
            <p className="text-muted-foreground">You can't go online until an admin records your renewed license. Contact Zoomo support with your new license.</p>
          </div>
        )}
        {!vehicleOk && (
          <div className="mb-3 space-y-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <p className="font-semibold">Your vehicle type is no longer supported</p>
            <p className="text-muted-foreground">Zoomo now offers only Tricycle and Motorcycle rides. Update your vehicle type to go online.</p>
            <div className="grid grid-cols-2 gap-2">
              {DRIVER_VEHICLES.map((v) => (
                <Button key={v.type} size="sm" variant="outline" onClick={() => void fixVehicle(v.type)}>
                  {v.emoji} {v.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {activeRide ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-lg font-bold">{STATUS_LABEL[activeRide.status]}</p>
              <div className="flex items-center gap-2">
                <SosButton
                  trip={{
                    rideId: activeRide.id,
                    driverName: `${profile?.full_name ?? "Driver"} (me, driver)`,
                    vehicle: vehicle?.type === "bike" ? "Motorcycle" : "Tricycle",
                    pickup: activeRide.pickup_address,
                    dropoff: activeRide.dropoff_address,
                  }}
                />
                <Badge variant="secondary">
                  {formatMoney(Number(activeRide.fare_estimate) - Number(activeRide.discount))}
                </Badge>
              </div>
            </div>
            <div className="space-y-1 rounded-2xl bg-secondary p-3 text-sm">
              <p className="flex gap-2">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                <span className="line-clamp-1">{activeRide.pickup_address}</span>
              </p>
              <p className="flex gap-2">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-foreground" />
                <span className="line-clamp-1">{activeRide.dropoff_address}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" asChild>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${target?.lat},${target?.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Navigation className="mr-2 h-4 w-4" /> Navigate
                </a>
              </Button>
              {isChatOpen(activeRide.status) && (
                <Button variant="outline" onClick={() => setShowChat((s) => !s)} aria-label="Chat with rider">
                  <MessageSquare className="h-4 w-4" />
                </Button>
              )}
            </div>
            {showChat && user && <RideChat rideId={activeRide.id} userId={user.id} status={activeRide.status} />}
            <div className="flex gap-2">
              {activeRide.status === "accepted" && (
                <Button className="flex-1" disabled={busy} onClick={() => setStatus("arriving")}>
                  Arrived at pickup
                </Button>
              )}
              {activeRide.status === "arriving" && (
                <Button className="flex-1" disabled={busy} onClick={() => setStatus("in_progress")}>
                  Start trip
                </Button>
              )}
              {activeRide.status === "in_progress" && (
                <Button className="flex-1" disabled={busy} onClick={complete}>
                  Complete trip
                </Button>
              )}
            </div>
            {activeRide.status !== "in_progress" && (
              <Button variant="ghost" className="w-full text-destructive" onClick={cancelTrip}>
                Cancel trip
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-border p-4">
              <div>
                <p className="text-xs text-muted-foreground">Earned today</p>
                <p className="text-2xl font-bold">{formatMoney(todayEarnings ?? 0)}</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/driver/earnings">
                  <TrendingUp className="mr-1 h-4 w-4" /> Earnings
                </Link>
              </Button>
            </div>
            {walletInfo && (
              <Link to="/driver/earnings" className="block rounded-2xl border border-border p-3">
                <p className="text-xs text-muted-foreground">{walletInfo.balance < 0 ? "Owed to Zoomo" : "Wallet balance"}</p>
                <p className={`text-lg font-bold ${walletInfo.balance < 0 ? "text-destructive" : ""}`}>
                  {formatMoney(Math.abs(walletInfo.balance))}
                </p>
                {walletInfo.blocked && (
                  <p className="mt-1 text-xs text-destructive">
                    You owe more than {formatMoney(walletInfo.limit)} in cash-trip commission. Please settle with Zoomo to go online and accept rides again.
                  </p>
                )}
              </Link>
            )}
            <Button asChild variant="ghost" className="w-full">
              <Link to="/driver/trips">View trip history</Link>
            </Button>
            {online && !walletInfo?.blocked && vehicleOk && !licenseExpired && driver?.status === "approved" ? (
              <>
                <RideBoard pos={pos} vehicleType={vehicle?.type ?? null} driverId={user?.id ?? ""} onAccepted={loadActive} />
                <NearbyRiders />
              </>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                {online ? "Ride requests are paused for your account." : "Go online to see available ride requests."}
              </p>
            )}
          </div>
        )}
      </div>


      {rateRide && user && (
        <RatingDialog
          open={!!rateRide}
          onOpenChange={(v) => !v && setRateRide(null)}
          rideId={rateRide.id}
          raterId={user.id}
          rateeId={rateRide.rider_id}
          title="How was your rider?"
          onDone={() => setRateRide(null)}
        />
      )}
    </div>
  );
}
