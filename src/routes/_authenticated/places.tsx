import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/Brand";
import { searchAddress, type Place } from "@/lib/geo";

export const Route = createFileRoute("/_authenticated/places")({
  head: () => ({
    meta: [
      { title: "Saved places — Zoomo" },
      { name: "description", content: "Save Home, Work and favourite Dumaguete spots for one-tap booking." },
      { property: "og:title", content: "Saved places — Zoomo" },
      { property: "og:description", content: "Save Home, Work and favourite Dumaguete spots for one-tap booking." },
    ],
  }),
  component: PlacesPage,
});

function PlacesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [placeLabel, setPlaceLabel] = useState("Home");
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<Place[]>([]);

  const { data: places } = useQuery({
    queryKey: ["saved-places", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("saved_places").select("*").order("created_at");
      return data ?? [];
    },
  });

  const addPlace = async (p: Place) => {
    if (!user) return;
    const { error } = await supabase.from("saved_places").insert({
      user_id: user.id,
      label: placeLabel || "Saved",
      address: p.address,
      lat: p.lat,
      lng: p.lng,
    });
    if (error) {
      toast.error("Could not save that place");
      return;
    }
    setPlaceQuery("");
    setPlaceResults([]);
    toast.success("Place saved");
    void qc.invalidateQueries({ queryKey: ["saved-places"] });
  };

  const removePlace = async (id: string) => {
    await supabase.from("saved_places").delete().eq("id", id);
    void qc.invalidateQueries({ queryKey: ["saved-places"] });
    toast.success("Place removed");
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <Link to="/account" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Account
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Saved places</h1>
      <p className="text-sm text-muted-foreground">Saved places show up as shortcuts on the booking screen.</p>

      <div className="mt-4 space-y-3 rounded-2xl border border-border p-4">
        <div className="flex gap-2">
          {["Home", "Work", "Other"].map((l) => (
            <Button key={l} size="sm" variant={placeLabel === l ? "default" : "outline"} onClick={() => setPlaceLabel(l)}>
              {l}
            </Button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await searchAddress(placeQuery);
            setPlaceResults(r);
            if (r.length === 0) toast.error("No matches found");
          }}
        >
          <Input
            placeholder={`Search ${placeLabel === "Other" ? "a place" : placeLabel.toLowerCase() + " address"} in Dumaguete area`}
            value={placeQuery}
            onChange={(e) => setPlaceQuery(e.target.value)}
          />
          <Button type="submit" variant="outline" aria-label="Search">
            <Plus className="h-4 w-4" />
          </Button>
        </form>
        {placeResults.map((r) => (
          <button
            key={`${r.lat}-${r.lng}`}
            onClick={() => addPlace(r)}
            className="block w-full rounded-lg p-2 text-left text-sm hover:bg-secondary"
          >
            {r.address}
          </button>
        ))}
        {(places ?? []).length === 0 && placeResults.length === 0 && (
          <EmptyState title="No saved places" description="Add Home and Work for one-tap booking." />
        )}
        {(places ?? []).map((p) => (
          <div key={p.id} className="flex items-center gap-2 rounded-xl border border-border p-2">
            <Badge variant="secondary">{p.label}</Badge>
            <span className="flex-1 truncate text-xs text-muted-foreground">{p.address}</span>
            <Button size="icon" variant="ghost" onClick={() => removePlace(p.id)} aria-label="Remove">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button asChild className="mt-4 w-full">
        <Link to="/ride">Book a ride</Link>
      </Button>
    </div>
  );
}
