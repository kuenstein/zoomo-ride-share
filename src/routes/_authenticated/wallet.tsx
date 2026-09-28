import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/Brand";
import { formatMoney } from "@/lib/geo";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — Zoomo" },
      { name: "description", content: "Top up your Zoomo wallet and review every transaction." },
      { property: "og:title", content: "Wallet — Zoomo" },
      { property: "og:description", content: "Top up your Zoomo wallet and review every transaction." },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    const { data, error } = await supabase.rpc("wallet_topup", { _amount: amount });
    setBusy(false);
    const res = data as unknown as { success: boolean; message?: string; balance?: number } | null;
    if (error || !res?.success) {
      toast.error(res?.message ?? "Top-up failed");
      return;
    }
    toast.success(`Added ${formatMoney(amount)} to your wallet`);
    void qc.invalidateQueries({ queryKey: ["wallet"] });
    void qc.invalidateQueries({ queryKey: ["wallet-txns"] });
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

      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold">Quick top-up (simulated)</p>
        <div className="flex gap-2">
          {[10, 25, 50, 100].map((a) => (
            <Button key={a} variant="outline" className="flex-1" disabled={busy} onClick={() => topUp(a)}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `$${a}`}
            </Button>
          ))}
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
                <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</p>
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
