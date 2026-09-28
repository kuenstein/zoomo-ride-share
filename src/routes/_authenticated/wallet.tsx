import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/Brand";
import { formatMoney, formatDateTime } from "@/lib/geo";
import { Input } from "@/components/ui/input";
import { createTopupCheckout } from "@/lib/payments.functions";


export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — Zoomo" },
      { name: "description", content: "Top up your Zoomo wallet with QR Ph — scan with GCash, Maya or any bank app — and review every transaction." },
      { property: "og:title", content: "Wallet — Zoomo" },
      { property: "og:description", content: "Top up your Zoomo wallet with QR Ph — scan with GCash, Maya or any bank app — and review every transaction." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const checkout = useServerFn(createTopupCheckout);
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState("");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("topup");
    if (p === "success") toast.success("Payment received — your balance updates in a few seconds.");
    if (p === "cancelled") toast.message("Top-up cancelled.");
    if (p) window.history.replaceState(null, "", "/wallet");
    if (p === "success") {
      const t = setInterval(() => {
        void qc.invalidateQueries({ queryKey: ["wallet"] });
        void qc.invalidateQueries({ queryKey: ["wallet-txns"] });
      }, 3000);
      const stop = setTimeout(() => clearInterval(t), 30000);
      return () => {
        clearInterval(t);
        clearTimeout(stop);
      };
    }
    return undefined;
  }, [qc]);

  const { data: wallet, isLoading } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: txns } = useQuery({
    queryKey: ["wallet-txns", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("wallet_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const topUp = async (amount: number) => {
    if (!Number.isFinite(amount) || amount < 50 || amount > 10000) {
      toast.error("Enter an amount from ₱50 to ₱10,000");
      return;
    }
    setBusy(true);
    try {
      const res = await checkout({ data: { amount, origin: window.location.origin } });
      if (!res.ok) {
        toast.error(res.error);
        setBusy(false);
        return;
      }
      // PayMongo checkout refuses to load inside an iframe (the preview pane),
      // so always open it in a full browser tab.
      const win = window.open(res.url, "_blank", "noopener,noreferrer");
      if (!win) {
        toast.error("Your browser blocked the payment tab — please allow pop-ups and try again.");
      } else {
        toast.success("Payment tab opened — your wallet updates automatically once you pay.");
      }
      setBusy(false);
    } catch {
      toast.error("Could not start payment");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="text-2xl font-bold">Wallet</h1>

      <div className="mt-4 rounded-3xl bg-ink p-6 text-ink-foreground">
        <p className="text-xs uppercase tracking-wide opacity-70">Available balance</p>
        {isLoading ? (
          <Skeleton className="mt-2 h-10 w-32" />
        ) : (
          <p className="mt-1 text-4xl font-bold">{formatMoney(wallet?.balance)}</p>
        )}
        <p className="mt-2 text-xs opacity-70">Wallet payments are deducted automatically at trip end.</p>
      </div>

      <div className="mt-4 space-y-3">
        <p className="text-sm text-muted-foreground">Pay with <span className="font-semibold text-foreground">QR Ph</span> — scan with GCash, Maya, or any bank or e-wallet app.</p>
        <p className="text-sm font-semibold">Top-up amount</p>
        <div className="grid grid-cols-4 gap-2">
          {[100, 200, 500, 1000].map((a) => (
            <Button key={a} variant="outline" disabled={busy} onClick={() => topUp(a)}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : formatMoney(a, { whole: true })}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            type="number"
            inputMode="numeric"
            min={50}
            max={10000}
            placeholder="Custom amount (₱50–₱10,000)"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
          <Button disabled={busy || !custom} onClick={() => topUp(Math.round(Number(custom)))}>
            Top up
          </Button>
        </div>
      </div>

      <h2 className="mt-6 text-sm font-semibold">Transactions</h2>
      <div className="mt-2 space-y-2">
        {(txns ?? []).length === 0 && (
          <EmptyState title="No transactions yet" description="Top up to get started." />
        )}
        {(txns ?? []).map((t) => {
          const positive = Number(t.amount) >= 0;
          return (
            <div key={t.id} className="flex items-center gap-3 rounded-2xl border border-border p-3">
              <div
                className={`grid h-9 w-9 place-items-center rounded-full ${positive ? "bg-accent/15 text-accent" : "bg-secondary"}`}
              >
                {positive ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{t.description ?? t.kind}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(t.created_at)}</p>
              </div>
              <p className={`font-semibold ${positive ? "text-accent" : ""}`}>
                {positive ? "+" : "-"}
                {formatMoney(Math.abs(Number(t.amount)))}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
