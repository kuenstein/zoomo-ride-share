import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/Brand";
import { formatMoney } from "@/lib/geo";
import { STATUS_LABEL } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Zoomo" },
      { name: "description", content: "Approve drivers, monitor rides and manage Zoomo pricing and promos." },
      { property: "og:title", content: "Admin — Zoomo" },
      { property: "og:description", content: "Approve drivers, monitor rides and manage Zoomo pricing and promos." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  if (loading) return <Skeleton className="m-4 h-64 rounded-2xl" />;
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="text-xl font-bold">Admins only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This area is restricted. Ask an existing admin to grant you access.
        </p>
      </div>
    );
  }
  return <AdminDashboard />;
}

function AdminDashboard() {
  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_stats");
      if (error) throw error;
      return data as unknown as Record<string, number>;
    },
  });

  const { data: drivers } = useQuery({
    queryKey: ["admin-drivers"],
    queryFn: async () => {
      const { data } = await supabase.from("drivers").select("*").order("created_at", { ascending: false });
      const ids = (data ?? []).map((d) => d.user_id);
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id,full_name,phone").in("id", ids)
        : { data: [] };
      const { data: vehicles } = await supabase.from("vehicles").select("*");
      return (data ?? []).map((d) => ({
        ...d,
        profile: (profiles ?? []).find((p) => p.id === d.user_id) ?? null,
        vehicle: (vehicles ?? []).find((v) => v.driver_id === d.id) ?? null,
      }));
    },
  });

  const { data: rides } = useQuery({
    queryKey: ["admin-rides"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rides")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const { data: promos } = useQuery({
    queryKey: ["admin-promos"],
    queryFn: async () => {
      const { data } = await supabase.from("promo_codes").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: pricing } = useQuery({
    queryKey: ["admin-pricing"],
    queryFn: async () => {
      const { data } = await supabase.from("pricing_settings").select("*").eq("id", 1).single();
      return data;
    },
  });

  const setDriverStatus = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("drivers").update({ status }).eq("id", id);
    if (error) {
      toast.error("Could not update driver");
      return;
    }
    toast.success(`Driver ${status}`);
    void qc.invalidateQueries({ queryKey: ["admin-drivers"] });
    void qc.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold">Admin</h1>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Rides today", value: stats?.rides_today ?? 0 },
          { label: "Revenue today", value: formatMoney(stats?.revenue_today) },
          { label: "Active drivers", value: stats?.active_drivers ?? 0 },
          { label: "Pending drivers", value: stats?.pending_drivers ?? 0 },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border p-3">
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
            <p className="text-xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="drivers" className="mt-6">
        <TabsList className="w-full">
          <TabsTrigger value="drivers" className="flex-1">Drivers</TabsTrigger>
          <TabsTrigger value="rides" className="flex-1">Rides</TabsTrigger>
          <TabsTrigger value="promos" className="flex-1">Promos</TabsTrigger>
          <TabsTrigger value="pricing" className="flex-1">Pricing</TabsTrigger>
        </TabsList>

        <TabsContent value="drivers" className="space-y-2">
          {(drivers ?? []).length === 0 && <EmptyState title="No driver applications yet" />}
          {(drivers ?? []).map((d) => (
            <div key={d.id} className="rounded-2xl border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{d.profile?.full_name || "Unnamed driver"}</p>
                  <p className="text-xs text-muted-foreground">
                    License {d.license_number} · {d.total_trips} trips
                  </p>
                  {d.vehicle && (
                    <p className="text-xs text-muted-foreground">
                      {d.vehicle.type} · {d.vehicle.color} {d.vehicle.make} {d.vehicle.model} · {d.vehicle.plate}
                    </p>
                  )}
                </div>
                <Badge variant={d.status === "approved" ? "default" : "secondary"}>{d.status}</Badge>
              </div>
              {d.status !== "approved" && (
                <div className="mt-2 flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => setDriverStatus(d.id, "approved")}>
                    <Check className="mr-1 h-4 w-4" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setDriverStatus(d.id, "rejected")}
                  >
                    <X className="mr-1 h-4 w-4" /> Reject
                  </Button>
                </div>
              )}
              {d.status === "approved" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={() => setDriverStatus(d.id, "rejected")}
                >
                  Revoke approval
                </Button>
              )}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="rides" className="space-y-2">
          {(rides ?? []).length === 0 && <EmptyState title="No rides yet" />}
          {(rides ?? []).map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-border p-3">
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium">{r.dropoff_address}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()} · {STATUS_LABEL[r.status]}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="font-bold">{formatMoney(r.final_fare ?? r.fare_estimate)}</p>
                <p className="text-[10px] text-muted-foreground">fee {formatMoney(r.commission)}</p>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="promos">
          <PromoManager promos={promos ?? []} onChange={() => qc.invalidateQueries({ queryKey: ["admin-promos"] })} />
        </TabsContent>

        <TabsContent value="pricing">
          {pricing && (
            <PricingEditor
              pricing={pricing}
              onSaved={() => {
                void qc.invalidateQueries({ queryKey: ["admin-pricing"] });
                void qc.invalidateQueries({ queryKey: ["pricing"] });
              }}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

type Promo = { id: string; code: string; discount_type: string; discount_value: number; active: boolean; times_used: number };

function PromoManager({ promos, onChange }: { promos: Promo[]; onChange: () => void }) {
  const [code, setCode] = useState("");
  const [type, setType] = useState<"percent" | "flat">("percent");
  const [value, setValue] = useState("10");

  const create = async () => {
    const { error } = await supabase.from("promo_codes").insert({
      code: code.trim().toUpperCase(),
      discount_type: type,
      discount_value: Number(value),
    });
    if (error) {
      toast.error("Could not create that code");
      return;
    }
    setCode("");
    toast.success("Promo code created");
    onChange();
  };

  const toggle = async (p: Promo) => {
    await supabase.from("promo_codes").update({ active: !p.active }).eq("id", p.id);
    onChange();
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-2xl border border-border p-3">
        <p className="font-semibold">New promo code</p>
        <Input placeholder="CODE" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <div className="flex gap-2">
          <Button
            variant={type === "percent" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setType("percent")}
          >
            Percent
          </Button>
          <Button
            variant={type === "flat" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setType("flat")}
          >
            Flat
          </Button>
        </div>
        <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
        <Button className="w-full" onClick={create} disabled={!code.trim()}>
          Create
        </Button>
      </div>

      {promos.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border p-3">
          <div className="flex-1">
            <p className="font-semibold">{p.code}</p>
            <p className="text-xs text-muted-foreground">
              {p.discount_type === "percent" ? `${p.discount_value}% off` : `${formatMoney(p.discount_value)} off`} ·
              used {p.times_used}×
            </p>
          </div>
          <Button size="sm" variant={p.active ? "outline" : "default"} onClick={() => toggle(p)}>
            {p.active ? "Disable" : "Enable"}
          </Button>
        </div>
      ))}
    </div>
  );
}

type Pricing = {
  base_fare: number;
  per_km: number;
  per_minute: number;
  minimum_fare: number;
  commission_percent: number;
  multiplier_economy: number;
  multiplier_comfort: number;
  multiplier_xl: number;
  multiplier_bike: number;
};

const FIELDS: { key: keyof Pricing; label: string }[] = [
  { key: "base_fare", label: "Base fare" },
  { key: "per_km", label: "Per km" },
  { key: "per_minute", label: "Per minute" },
  { key: "minimum_fare", label: "Minimum fare" },
  { key: "commission_percent", label: "Commission %" },
  { key: "multiplier_economy", label: "Economy ×" },
  { key: "multiplier_comfort", label: "Comfort ×" },
  { key: "multiplier_xl", label: "XL ×" },
  { key: "multiplier_bike", label: "Bike ×" },
];

function PricingEditor({ pricing, onSaved }: { pricing: Pricing; onSaved: () => void }) {
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map((f) => [f.key, String(pricing[f.key])])),
  );
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const patch = Object.fromEntries(FIELDS.map((f) => [f.key, Number(form[f.key])]));
    const { error } = await supabase.from("pricing_settings").update(patch).eq("id", 1);
    setBusy(false);
    if (error) {
      toast.error("Could not save pricing");
      return;
    }
    toast.success("Pricing updated");
    onSaved();
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border p-4">
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label htmlFor={f.key}>{f.label}</Label>
            <Input
              id={f.key}
              type="number"
              step="0.01"
              value={form[f.key]}
              onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <Button className="w-full" onClick={save} disabled={busy}>
        Save pricing
      </Button>
    </div>
  );
}
