import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogOut, Plus, Star, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { EmptyState } from "@/components/Brand";
import { searchAddress, type Place } from "@/lib/geo";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Account — Zoomo" },
      { name: "description", content: "Manage your Zoomo profile, saved places and role." },
      { property: "og:title", content: "Account — Zoomo" },
      { property: "og:description", content: "Manage your Zoomo profile, saved places and role." },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user, profile, roles, refresh, signOut, isDriver } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState("");
  const [saving, setSaving] = useState(false);

  const [placeLabel, setPlaceLabel] = useState("Home");
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<Place[]>([]);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
    setAvatar(profile?.avatar_url ?? "");
  }, [profile]);

  const { data: places } = useQuery({
    queryKey: ["saved-places", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("saved_places").select("*").order("created_at");
      return data ?? [];
    },
  });

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, phone: phone || null, avatar_url: avatar || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Could not save your profile");
      return;
    }
    toast.success("Profile updated");
    await refresh();
  };

  const becomeDriver = async () => {
    if (!user) return;
    const { error } = await supabase.from("user_roles").insert({ user_id: user.id, role: "driver" });
    if (error && !error.message.includes("duplicate")) {
      toast.error("Could not switch role");
      return;
    }
    await refresh();
    toast.success("Driver mode unlocked — finish your setup");
    navigate({ to: "/driver" });
  };

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Account</h1>
        <ThemeToggle />
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border p-4">
        <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-secondary text-xl font-bold">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            (profile?.full_name || user?.email || "Z").charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex-1">
          <p className="font-semibold">{profile?.full_name || "Zoomo user"}</p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
          <p className="mt-1 flex items-center gap-1 text-xs">
            <Star className="h-3 w-3 fill-accent text-accent" />
            {Number(profile?.rating ?? 5).toFixed(2)} ({profile?.rating_count ?? 0})
          </p>
        </div>
        <div className="flex flex-col gap-1">
          {roles.map((r) => (
            <Badge key={r} variant="secondary" className="capitalize">
              {r}
            </Badge>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-3 rounded-2xl border border-border p-4">
        <p className="font-semibold">Profile</p>
        <div className="space-y-2">
          <Label htmlFor="fn">Full name</Label>
          <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ph">Phone</Label>
          <Input id="ph" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="av">Avatar URL</Label>
          <Input id="av" value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://…" />
        </div>
        <Button onClick={save} disabled={saving} className="w-full">
          Save changes
        </Button>
      </div>

      <div className="mt-4 space-y-3 rounded-2xl border border-border p-4">
        <p className="font-semibold">Saved places</p>
        <div className="flex gap-2">
          {["Home", "Work", "Other"].map((l) => (
            <Button
              key={l}
              size="sm"
              variant={placeLabel === l ? "default" : "outline"}
              onClick={() => setPlaceLabel(l)}
            >
              {l}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Search an address"
            value={placeQuery}
            onChange={(e) => setPlaceQuery(e.target.value)}
          />
          <Button
            variant="outline"
            onClick={async () => {
              const r = await searchAddress(placeQuery);
              setPlaceResults(r);
              if (r.length === 0) toast.error("No matches found");
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
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

      {!isDriver && (
        <div className="mt-4 rounded-2xl bg-ink p-5 text-ink-foreground">
          <p className="font-semibold">Want to earn with Zoomo?</p>
          <p className="mt-1 text-sm opacity-80">Switch on driver mode and complete your vehicle setup.</p>
          <Button className="mt-3" onClick={becomeDriver}>
            Become a driver
          </Button>
        </div>
      )}

      <Button
        variant="outline"
        className="mt-6 w-full"
        onClick={async () => {
          await signOut();
          navigate({ to: "/" });
        }}
      >
        <LogOut className="mr-2 h-4 w-4" /> Sign out
      </Button>
    </div>
  );
}
