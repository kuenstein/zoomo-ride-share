import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/Brand";
import { formatMoney, formatDateTime } from "@/lib/geo";

export function PayoutsAdmin() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-payouts"],
    queryFn: async () => {
      const { data: reqs } = await supabase.from("payout_requests").select("*").order("created_at", { ascending: false }).limit(100);
      const { data: drivers } = await supabase.from("drivers").select("user_id");
      const ids = Array.from(new Set([...(reqs ?? []).map((r) => r.user_id), ...(drivers ?? []).map((d) => d.user_id)]));
      const [profiles, wallets] = ids.length
        ? await Promise.all([
            supabase.from("profiles").select("id,full_name").in("id", ids).then((r) => r.data ?? []),
            supabase.from("wallets").select("user_id,balance").in("user_id", ids).then((r) => r.data ?? []),
          ])
        : [[], []];
      const name = (id: string) => profiles.find((p) => p.id === id)?.full_name ?? "Driver";
      const balances = (drivers ?? []).map((d) => ({
        user_id: d.user_id,
        name: name(d.user_id),
        balance: Number(wallets.find((w) => w.user_id === d.user_id)?.balance ?? 0),
      }));
      return { reqs: (reqs ?? []).map((r) => ({ ...r, name: name(r.user_id) })), balances };
    },
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["admin-payouts"] });

  const resolve = async (id: string, status: "paid" | "rejected") => {
    const notes = status === "rejected" ? (window.prompt("Reason for rejecting (shown to the driver)") ?? "") : "";
    const { data: res, error } = await supabase.rpc("admin_resolve_payout", { _id: id, _status: status, _notes: notes });
    const r = res as unknown as { success: boolean; message?: string } | null;
    if (error || !r?.success) {
      toast.error(r?.message ?? "Could not update payout");
      return;
    }
    toast.success(status === "paid" ? "Marked as paid" : "Rejected — amount returned to wallet");
    refresh();
  };

  const [settle, setSettle] = useState({ user_id: "", amount: "", note: "" });
  const recordSettlement = async () => {
    const amt = Number(settle.amount);
    if (!settle.user_id || !Number.isFinite(amt) || amt === 0) {
      toast.error("Pick a driver and enter an amount");
      return;
    }
    const { data: res, error } = await supabase.rpc("admin_wallet_adjust", { _user_id: settle.user_id, _amount: amt, _note: settle.note });
    const r = res as unknown as { success: boolean; message?: string } | null;
    if (error || !r?.success) {
      toast.error(r?.message ?? "Could not record settlement");
      return;
    }
    toast.success("Settlement recorded");
    setSettle({ user_id: "", amount: "", note: "" });
    refresh();
  };

  if (isLoading || !data) return <Skeleton className="h-40 rounded-2xl" />;

  return (
    <>
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Payout requests</h2>
        <p className="text-xs text-muted-foreground">
          Send the money yourself (GCash / bank), then mark it paid. Rejecting returns the amount to the driver's wallet.
        </p>
        {data.reqs.length === 0 && <EmptyState title="No payout requests" description="Driver payout requests will appear here." />}
        {data.reqs.map((r) => (
          <div key={r.id} className="rounded-2xl border border-border p-3">
            <div className="flex items-center justify-between">
              <p className="font-medium">
                {r.name} · {formatMoney(Number(r.amount))}
              </p>
              <Badge variant={r.status === "pending" ? "default" : "secondary"}>{r.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {r.method} · {formatDateTime(r.created_at)}
            </p>
            {r.notes && <p className="mt-1 text-xs">{r.notes}</p>}
            {r.status === "pending" && (
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => void resolve(r.id, "paid")}>
                  <Check className="mr-1 h-4 w-4" />
                  Mark paid
                </Button>
                <Button size="sm" variant="outline" onClick={() => void resolve(r.id, "rejected")}>
                  <X className="mr-1 h-4 w-4" />
                  Reject
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-2 rounded-2xl border border-border p-4">
        <h2 className="text-sm font-semibold">Driver balances & settlements</h2>
        <p className="text-xs text-muted-foreground">Use a positive amount when a driver pays what they owe; negative to deduct.</p>
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {data.balances.map((b) => (
            <button
              key={b.user_id}
              type="button"
              onClick={() => setSettle((s) => ({ ...s, user_id: b.user_id, amount: b.balance < 0 ? String(-b.balance) : s.amount }))}
              className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm ${settle.user_id === b.user_id ? "bg-secondary" : ""}`}
            >
              <span>{b.name}</span>
              <span className={b.balance < 0 ? "text-destructive" : ""}>
                {b.balance < 0 ? `Owes ${formatMoney(-b.balance)}` : formatMoney(b.balance)}
              </span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" placeholder="Amount (₱)" value={settle.amount} onChange={(e) => setSettle((s) => ({ ...s, amount: e.target.value }))} />
          <Input placeholder="Note (e.g. cash received)" value={settle.note} onChange={(e) => setSettle((s) => ({ ...s, note: e.target.value }))} />
        </div>
        <Button className="w-full" onClick={() => void recordSettlement()} disabled={!settle.user_id}>
          Record settlement
        </Button>
      </div>
    </>
  );
}
