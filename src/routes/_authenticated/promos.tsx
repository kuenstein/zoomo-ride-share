import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/geo";

export const Route = createFileRoute("/_authenticated/promos")({
  head: () => ({
    meta: [
      { title: "Promo codes — Zoomo" },
      { name: "description", content: "Check a Zoomo promo code and apply it to your next ride." },
      { property: "og:title", content: "Promo codes — Zoomo" },
      { property: "og:description", content: "Check a Zoomo promo code and apply it to your next ride." },
    ],
  }),
  component: PromosPage,
});

const SAMPLE_FARE = 150;

function PromosPage() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ code: string; valid: boolean; discount: number; message: string } | null>(null);

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("validate_promo", { _code: c, _amount: SAMPLE_FARE });
    setBusy(false);
    if (error) {
      toast.error("Could not check that code");
      return;
    }
    const res = data as unknown as { valid: boolean; discount?: number; message: string };
    setResult({ code: c, valid: res.valid, discount: Number(res.discount ?? 0), message: res.message });
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <Link to="/account" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Account
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Promo codes</h1>
      <p className="text-sm text-muted-foreground">Check a code, then use it on your next booking.</p>

      <form onSubmit={check} className="mt-4 flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-border px-3">
          <Ticket className="h-4 w-4 text-accent" />
          <Input
            className="border-0 px-0 shadow-none focus-visible:ring-0"
            placeholder="e.g. WELCOME10"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setResult(null);
            }}
          />
        </div>
        <Button type="submit" disabled={busy || !code.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
        </Button>
      </form>

      {result && (
        <div className={`mt-4 rounded-2xl border p-4 ${result.valid ? "border-accent/40 bg-accent/10" : "border-destructive/40 bg-destructive/10"}`}>
          <p className="font-semibold">{result.message}</p>
          {result.valid && (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                Example: {formatMoney(result.discount)} off a {formatMoney(SAMPLE_FARE)} fare. The final discount is
                confirmed when you book.
              </p>
              <Button asChild className="mt-3 w-full">
                <Link to="/ride" search={{ promo: result.code }}>Use on my next ride</Link>
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
