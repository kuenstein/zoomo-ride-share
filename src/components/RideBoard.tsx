import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Map } from "@/components/Map";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatMoney, haversineKm, type LatLng } from "@/lib/geo";
import { playRequestAlert, useTitleFlash } from "@/lib/alerts";
import type { Database } from "@/integrations/supabase/types";

type Ride = Database["public"]["Tables"]["rides"]["Row"];
const TTL_MS = 2 * 60 * 1000;
const RADIUS_KM = 5;

export function rideFare(r: Ride) {
  const base = r.fare_offer != null ? Number(r.fare_offer) : Number(r.fare_estimate) - Number(r.discount);
  return base + Number(r.extras_fee ?? 0);
}

function short(addr: string) {
  return addr.split(",").slice(0, 2).join(",");
}

function ago(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ${s % 60}s ago`;
}

export function RideBoard({
  pos,
  vehicleType,
  driverId,
  onAccepted,
}: {
  pos: LatLng | null;
  vehicleType: string | null;
  driverId: string;
  onAccepted: () => void | Promise<void>;
}) {
  const [rides, setRides] = useState<Ride[]>([]);
  const [sort, setSort] = useState<"near" | "fare">("near");
  const [now, setNow] = useState(Date.now());
  const [selected, setSelected] = useState<Ride | null>(null);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  const remove = useCallback((id: string) => {
    setRides((cur) => cur.filter((r) => r.id !== id));
    setSelected((s) => (s?.id === id ? null : s));
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase
        .from("rides")
        .select("*")
        .eq("status", "requested")
        .is("driver_id", null)
        .gte("requested_at", new Date(Date.now() - TTL_MS).toISOString())
        .order("requested_at", { ascending: false })
        .limit(50);
      if (alive) setRides(data ?? []);
    };
    void load();
    const ch = supabase
      .channel("driver-ride-board")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "rides" }, (p) => {
        const r = p.new as Ride;
        if (r.status !== "requested") return;
        setRides((cur) => (cur.some((x) => x.id === r.id) ? cur : [r, ...cur]));
        setFresh((f) => new Set(f).add(r.id));
        setTimeout(() => setFresh((f) => { const n = new Set(f); n.delete(r.id); return n; }), 1500);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rides" }, (p) => {
        const r = p.new as Ride;
        const eligible =
          r.status === "requested" && !r.driver_id &&
          (!r.target_driver_id || (r.target_driver_id === driverId && r.target_status === "pending"));
        if (!eligible) return remove(r.id);
        setRides((cur) => [r, ...cur.filter((x) => x.id !== r.id)]);
        if (r.target_driver_id === driverId) {
          setFresh((f) => new Set(f).add(r.id));
          setTimeout(() => setFresh((f) => { const n = new Set(f); n.delete(r.id); return n; }), 1500);
        }
      })
      .subscribe();
    const poll = setInterval(() => void load(), 30000);
    return () => {
      alive = false;
      clearInterval(poll);
      void supabase.removeChannel(ch);
    };
  }, [remove, driverId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const direct = useMemo(
    () =>
      rides.filter(
        (r) =>
          r.target_driver_id === driverId && r.target_status === "pending" &&
          r.target_expires_at != null && new Date(r.target_expires_at).getTime() > now,
      ),
    [rides, driverId, now],
  );

  const visible = useMemo(() => {
    const list = rides
      .filter((r) => !r.target_driver_id)
      .filter((r) => now - new Date(r.requested_at).getTime() < TTL_MS)
      .filter((r) => !vehicleType || r.vehicle_type === vehicleType)
      .map((r) => ({ r, away: pos ? haversineKm(pos, { lat: r.pickup_lat, lng: r.pickup_lng }) : null }))
      .filter((x) => x.away == null || x.away <= RADIUS_KM);
    return list.sort((a, b) =>
      sort === "fare" ? rideFare(b.r) - rideFare(a.r) : (a.away ?? 0) - (b.away ?? 0),
    );
  }, [rides, now, vehicleType, pos, sort]);

  const count = visible.length;
  useTitleFlash(fresh.size > 0);
  useEffect(() => {
    if (fresh.size > 0) playRequestAlert();
  }, [fresh.size]);

  const decline = async (id: string) => {
    const { data } = await supabase.rpc("decline_direct_ride", { _ride_id: id });
    const res = data as unknown as { success: boolean; message?: string } | null;
    remove(id);
    if (res?.success) toast.message("Request declined — the rider will pick someone else");
  };

  const accept = async (ride?: Ride) => {
    const target = ride ?? selected;
    if (!target) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("accept_ride", { _ride_id: target.id });
    setBusy(false);
    const res = data as unknown as { success: boolean; code?: string; message?: string } | null;
    if (error || !res?.success) {
      if (res?.code === "taken" || !res) {
        toast.info(target.target_driver_id ? "This request has expired" : "Already taken — another driver got this one");
        remove(target.id);
      } else toast.error(res.message ?? "Could not accept this ride");
      setSelected(null);
      return;
    }
    toast.success("Ride accepted — head to pickup");
    setSelected(null);
    await onAccepted();
  };

  return (
    <section className="space-y-3">
      {direct.map((r) => {
        const left = Math.max(0, (new Date(r.target_expires_at!).getTime() - now) / 45000);
        const away = pos ? haversineKm(pos, { lat: r.pickup_lat, lng: r.pickup_lng }) : null;
        return (
          <div key={r.id} className="overflow-hidden rounded-2xl border-2 border-accent bg-accent/10 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-2 p-3">
              <p className="text-sm font-bold">⭐ A rider chose you specifically</p>
              <p className="truncate text-sm">{short(r.pickup_address)} → {short(r.dropoff_address)}</p>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{away != null ? `${away.toFixed(1)} km to pickup · ` : ""}{r.distance_km} km trip</span>
                <span className="font-bold text-foreground">{formatMoney(rideFare(r))}</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => decline(r.id)}>Decline</Button>
                <Button size="sm" className="flex-1" disabled={busy} onClick={() => accept(r)}>
                  Accept · {Math.ceil(left * 45)}s
                </Button>
              </div>
            </div>
            <div className="h-1 bg-secondary">
              <div className="h-full bg-accent transition-[width] duration-1000 ease-linear" style={{ width: `${left * 100}%` }} />
            </div>
          </div>
        );
      })}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          Available rides
          <span className="grid h-6 min-w-6 place-items-center rounded-full bg-accent px-2 text-xs font-bold text-accent-foreground">
            {count}
          </span>
        </h2>
        <div className="flex rounded-full border border-border p-0.5 text-xs">
          {(["near", "fare"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setSort(k)}
              className={`rounded-full px-3 py-1 font-medium ${sort === k ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {k === "near" ? "Nearest" : "Highest fare"}
            </button>
          ))}
        </div>
      </div>

      {count === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No open requests within {RADIUS_KM} km right now. New ones appear here automatically.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map(({ r, away }) => {
            const age = now - new Date(r.requested_at).getTime();
            const left = Math.max(0, 1 - age / TTL_MS);
            return (
              <li
                key={r.id}
                className={`overflow-hidden rounded-2xl border border-border bg-card transition-colors ${fresh.has(r.id) ? "animate-in fade-in slide-in-from-top-2 border-accent" : ""}`}
              >
                <button className="w-full p-3 text-left hover:bg-secondary" onClick={() => setSelected(r)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1 text-sm">
                      <p className="flex gap-2">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                        <span className="truncate">{short(r.pickup_address)}</span>
                      </p>
                      <p className="flex gap-2">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-foreground" />
                        <span className="truncate">{short(r.dropoff_address)}</span>
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-bold">{formatMoney(rideFare(r))}</p>
                      <p className="text-xs text-muted-foreground">{r.distance_km} km trip</p>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                    <span>{away != null ? `${away.toFixed(1)} km to pickup` : "Nearby"}{r.passengers > 1 ? ` · ${r.passengers} pax` : ""}</span>
                    <span>{ago(age)}</span>
                  </div>
                </button>
                <div className="h-1 bg-secondary">
                  <div className="h-full bg-accent transition-[width] duration-1000 ease-linear" style={{ width: `${left * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <SheetContent side="bottom" className="z-[700] mx-auto max-w-lg rounded-t-3xl">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>Take this ride?</SheetTitle>
              </SheetHeader>
              <div className="mt-3 h-40 overflow-hidden rounded-2xl">
                <Map
                  center={{ lat: selected.pickup_lat, lng: selected.pickup_lng }}
                  pickup={{ lat: selected.pickup_lat, lng: selected.pickup_lng }}
                  dropoff={{ lat: selected.dropoff_lat, lng: selected.dropoff_lng }}
                  route={[[selected.pickup_lat, selected.pickup_lng], [selected.dropoff_lat, selected.dropoff_lng]]}
                  className="h-full w-full"
                />
              </div>
              <div className="mt-3 space-y-1 text-sm">
                <p><span className="text-muted-foreground">Pickup:</span> {selected.pickup_address}</p>
                <p><span className="text-muted-foreground">Dropoff:</span> {selected.dropoff_address}</p>
                <div className="flex justify-between pt-2">
                  <span className="text-muted-foreground">{selected.distance_km} km</span>
                  <span className="text-lg font-bold">{formatMoney(rideFare(selected))}</span>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setSelected(null)}>Back</Button>
                <Button className="flex-1" disabled={busy} onClick={() => accept()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Accept"}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}
