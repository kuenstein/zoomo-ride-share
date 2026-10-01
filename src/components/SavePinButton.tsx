import { useState } from "react";
import { toast } from "sonner";
import { BookmarkPlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PIN_CATEGORIES } from "@/hooks/useCommunityPins";
import type { LatLng } from "@/lib/geo";

/** Saves the current pickup-pin spot as a named community pin, shared with all users. */
export function SavePinButton({ at }: { at: LatLng | null }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<(typeof PIN_CATEGORIES)[number]>("meeting point");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!at) return;
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("community_pins").insert({
      name: name.trim(),
      category,
      lat: at.lat,
      lng: at.lng,
      created_by: u.user?.id ?? "",
    });
    setBusy(false);
    if (error) {
      const m = error.message;
      toast.error(m.includes("Daily limit") || m.includes("service area") ? m : "Couldn't save this spot");
      return;
    }
    toast.success("Spot submitted — it'll appear for everyone once an admin approves it");
    setOpen(false);
    setName("");
  };

  if (!open)
    return (
      <Button size="sm" variant="outline" disabled={!at} onClick={() => setOpen(true)}>
        <BookmarkPlus className="mr-1 h-3.5 w-3.5" /> Save this spot
      </Button>
    );

  return (
    <div className="w-full space-y-2 rounded-2xl border border-border p-3">
      <p className="text-sm font-semibold">Share the pickup pin's spot</p>
      <p className="text-xs text-muted-foreground">
        Saves a fixed, named point that all riders and drivers will see. It never shares your live location.
      </p>
      <Input placeholder="e.g. Silliman gate 3" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
      <div className="flex flex-wrap gap-1">
        {PIN_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-full border px-2.5 py-1 text-xs capitalize ${category === c ? "border-accent bg-accent/10" : "border-border"}`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={busy || name.trim().length < 2}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save pin"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}
