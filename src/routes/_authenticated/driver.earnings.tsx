import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/Brand";
import { formatMoney, formatDateTime } from "@/lib/geo";

export const Route = createFileRoute("/_authenticated/driver/earnings")({
  head: () => ({
    meta: [
      { title: "Earnings — Zoomo" },
      { name: "description", content: "Track your Zoomo earnings, wallet balance and payouts." },
      { property: "og:title", content: "Earnings — Zoomo" },
      { property: "og:description", content: "Track your Zoomo earnings, wallet balance and payouts." },
    ],
  }),
  component: EarningsPage,
});

function EarningsPage() {
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["earnings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [rides, activity, wallet, requests] = await Promise.all([
        supabase
          .from("rides")
          .select("driver_earnings,final_fare,completed_at")
          .eq("driver_id", user!.id)
          .eq("status", "completed")
          .order("completed_at", { ascending: false }),
        supabase.from("wallet_transactions").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(30),
        supabase.from("wallets").select("balance").eq("user_id", user!.id).maybeSingle(),
        supabase.from("payout_requests").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(20),
      ]);
      return {
        rides: rides.data ?? [],
        activity: activity.data ?? [],
        balance: Number(wallet.data?.balance ?? 0),
        requests: requests.data ?? [],
      };
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

  const requestPayout = async () => {
    const amt = Math.round(Number(amount));
    if (!Number.isFinite(amt) || amt < 100) {
      toast.error("Minimum payout is ₱100");
      return;
    }
    if (amt > data.balance) {
      toast.error("Amount is more than your wallet balance");
      return;
    }
    setBusy(true);
    const { data: res, error } = await supabase.rpc("request_payout", { _amount: amt, _method: method });
    setBusy(false);
    const r = res as unknown as { success: boolean; message?: string } | null;
    if (error || !r?.success) {
      toast.error(r?.message ?? "Could not request payout");
      return;
    }
    toast.success("Payout requested — Zoomo will send it soon");
    setAmount("");
    setMethod("");
    void refetch();
  };

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
    return { day: d.toLocaleDateString("en-PH", { weekday: "short", timeZone: "Asia/Manila" }), total: Math.round(total * 100) / 100 };
  });

  const owed = data.balance < 0;

  return (
    <div className="mx-auto max-w-lg px-4 py-4">
      <Link to="/driver" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Earnings</h1>

      <div className="mt-4 rounded-2xl border border-border p-4">
        <p className="text-xs text-muted-foreground">{owed ? "Owed to Zoomo" : "Wallet balance"}</p>
        <p className={`text-2xl font-bold ${owed ? "text-destructive" : ""}`}>{formatMoney(Math.abs(data.balance))}</p>
        {owed ? (
          <p className="mt-1 text-xs text-muted-foreground">
            This is Zoomo's commission from cash trips. Settle it with Zoomo to keep driving without interruption.
          </p>
        ) : data.balance >= 100 ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-semibold">Request payout (min ₱100)</p>
            <Input type="number" min={100} max={data.balance} placeholder="Amount (₱)" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Input placeholder="GCash number or bank + account" value={method} onChange={(e) => setMethod(e.target.value)} />
            <Button className="w-full" disabled={busy} onClick={() => void requestPayout()}>
              Request payout
            </Button>
          </div>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">You can request a payout once your balance reaches ₱100.</p>
        )}
      </div>

      {data.requests.length > 0 && (
        <div className="mt-3 space-y-2">
          <h2 className="text-sm font-semibold">Payout requests</h2>
          {data.requests.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-2xl border border-border p-3 text-sm">
              <div>
                <p className="font-medium">
                  {formatMoney(Number(r.amount))} · {r.method}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(r.created_at)}
                  {r.notes ? ` · ${r.notes}` : ""}
                </p>
              </div>
              <span className="text-xs font-semibold capitalize">{r.status}</span>
            </div>
          ))}
        </div>
      )}

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

      <Link to="/driver/trips" className="mt-4 inline-block text-sm font-medium text-accent">
        {data.rides.length} completed trips · View trip history
      </Link>

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

      <h2 className="mt-6 text-sm font-semibold">Wallet activity</h2>
      <div className="mt-2 space-y-2">
        {data.activity.length === 0 && (
          <EmptyState title="No wallet activity yet" description="Wallet-paid trips add to your wallet; cash trips deduct Zoomo's commission." />
        )}
        {data.activity.map((p) => {
          const amt = Number(p.amount);
          return (
            <div key={p.id} className="flex items-center justify-between rounded-2xl border border-border p-3">
              <div>
                <p className="text-sm font-medium">{p.description ?? p.kind}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(p.created_at)}</p>
              </div>
              <p className={`font-semibold ${amt < 0 ? "text-destructive" : "text-accent"}`}>
                {amt < 0 ? "−" : "+"}
                {formatMoney(Math.abs(amt))}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
