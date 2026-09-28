import { useState } from "react";
import { toast } from "sonner";
import { Phone, Share2, Siren, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentPosition, type LatLng } from "@/lib/geo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type SosTripInfo = {
  rideId: string;
  driverName?: string | null;
  plate?: string | null;
  vehicle?: string | null;
  pickup: string;
  dropoff: string;
};

async function trustedContactNames(): Promise<string[]> {
  const { data } = await supabase.from("trusted_contacts").select("name").order("created_at");
  return (data ?? []).map((c) => c.name);
}

export function buildShareText(t: SosTripInfo, pos: LatLng | null, contacts: string[] = []) {
  const lines = [
    contacts.length ? `Hi ${contacts.join(", ")} — I'm on a Zoomo trip and want you to know where I am.` : "I'm on a Zoomo trip — sharing my trip details.",
    `Driver: ${t.driverName ?? "unknown"}`,
    `Vehicle: ${t.vehicle ?? "unknown"} · Plate: ${t.plate ?? "unknown"}`,
    `From: ${t.pickup}`,
    `To: ${t.dropoff}`,
  ];
  if (pos) lines.push(`My location now: https://maps.google.com/?q=${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}`);
  return lines.join("\n");
}

export async function shareTrip(t: SosTripInfo, pos: LatLng | null) {
  const text = buildShareText(t, pos, await trustedContactNames());
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title: "My Zoomo trip", text });
      return;
    } catch {
      /* cancelled */
    }
  }
  await navigator.clipboard?.writeText(text);
  toast.success("Trip details copied — paste them to your contact");
}

export function SosButton({ trip }: { trip: SosTripInfo }) {
  const [confirm, setConfirm] = useState(false);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState<LatLng | null>(null);

  const raise = async () => {
    setBusy(true);
    let p: LatLng | null = null;
    try {
      p = await getCurrentPosition();
    } catch {
      /* location optional */
    }
    setPos(p);
    const { data, error } = await supabase.rpc("raise_sos", { _ride_id: trip.rideId, _lat: p?.lat, _lng: p?.lng });
    setBusy(false);
    const res = data as { success: boolean; message?: string } | null;
    if (error || !res?.success) {
      toast.error(res?.message ?? "Couldn't alert Zoomo — call 911 now");
    } else {
      toast.success("Zoomo safety team alerted");
    }
    setConfirm(false);
    setActive(true);
  };

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setConfirm(true)} aria-label="SOS emergency">
        <Siren className="mr-1 h-4 w-4" /> SOS
      </Button>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send an SOS?</DialogTitle>
            <DialogDescription>
              Zoomo's safety team will be alerted with this trip and your current location. You'll also get quick links to emergency hotlines.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={raise} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, send SOS"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={active} onOpenChange={setActive}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Help is a tap away</DialogTitle>
            <DialogDescription>If you are in immediate danger, call emergency services now.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button asChild variant="destructive" className="h-12">
              <a href="tel:911">
                <Phone className="mr-2 h-4 w-4" /> Call 911 (National Emergency)
              </a>
            </Button>
            <Button asChild variant="outline" className="h-12">
              <a href="tel:143">
                <Phone className="mr-2 h-4 w-4" /> Call 143 (Philippine Red Cross)
              </a>
            </Button>
            <Button variant="outline" className="h-12" onClick={() => void shareTrip(trip, pos)}>
              <Share2 className="mr-2 h-4 w-4" /> Share live trip details
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
