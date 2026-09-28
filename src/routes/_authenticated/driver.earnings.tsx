import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/Brand";
import { formatMoney } from "@/lib/geo";

export const Route = createFileRoute("/_authenticated/driver/earnings")({
  head: () => ({
    meta: [
      { title: "Earnings — Zoomo" },
      { name: "description", content: "Track your Zoomo earnings for today, this week and all time." },
      { property: "og:title", content: "Earnings — Zoomo" },
      { property: "og:description", content: "Track your Zoomo earnings for today, this week and all time." },
    ],
  }),
  component: EarningsPage,
});

function EarningsPage() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["earnings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: rides } = await supabase
        .from("rides")
        .select("driver_earnings,final_fare,completed_at")
        .eq("driver_id", user!.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false });
      const { data: payouts } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("kind", "earning")
        .order("created_at", { ascending: false })
        .limit(30);
      return { rides: rides ?? [], payouts: payouts ?? [] };
    },
  });

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-lg space-y-3 p-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    );
  }

  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startWeek = new Date(startToday);
  startWeek.setDate(startWeek.getDate() - 6);

  const sum = (from?: Date) =>
    data.rides
      .filter((r) => (from ? r.completed_at && new Date(r.completed_at) >= from : true))
      .reduce((s, r) => s + Number(r.driver_earnings), 0);

  const chart = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(startToday);
    d.setDate(d.getDate() - (6 - i));
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const total = data.rides
      .filter((r) => r.completed_at && new Date(r.completed_at) >= d && new Date(r.completed_at) < next)
      .reduce((s, r) => s + Number(r.driver_earnings), 0);
    return { day: d.toLocaleDateString(undefined, { weekday: "short" }), total: Math.round(total * 100) / 100 };
  });

  return (
    <div className="mx-auto max-w-lg px-4 py-4">
      <Link to="/driver" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Drive
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Earnings</h1>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { label: "Today", value: sum(startToday) },
          { label: "This week", value: sum(startWeek) },
          { label: "All time", value: sum() },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border p-3">
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
            <p className="text-lg font-bold">{formatMoney(s.value)}</p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-sm text-muted-foreground">{data.rides.length} completed trips</p>

      <div className="mt-3 h-56 rounded-2xl border border-border p-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis tickLine={false} axisLine={false} fontSize={11} width={30} />
            <Tooltip
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 12,
                color: "var(--color-popover-foreground)",
              }}
            />
            <Bar dataKey="total" fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <h2 className="mt-6 text-sm font-semibold">Payout history</h2>
      <div className="mt-2 space-y-2">
        {data.payouts.length === 0 && (
          <EmptyState title="No payouts yet" description="Completed trips pay into your wallet instantly." />
        )}
        {data.payouts.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-2xl border border-border p-3">
            <div>
              <p className="text-sm font-medium">{p.description ?? "Trip earnings"}</p>
              <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</p>
            </div>
            <p className="font-semibold text-accent">+{formatMoney(Number(p.amount))}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
