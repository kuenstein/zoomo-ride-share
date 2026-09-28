import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { suggestTrip, type TripSuggestion } from "@/lib/trip-assistant.functions";
import { VEHICLE_LABEL } from "@/lib/pricing";

export function TripAssistant({
  savedPlaces,
  onApply,
}: {
  savedPlaces: string[];
  onApply: (s: TripSuggestion) => void | Promise<void>;
}) {
  const run = useServerFn(suggestTrip);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TripSuggestion | null>(null);

  const ask = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await run({ data: { description: text, savedPlaces } });
      if (!res.ok) toast.error(res.error);
      else setResult(res.suggestion);
    } catch {
      toast.error("The assistant couldn't answer. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!open)
    return (
      <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => setOpen(true)}>
        <Sparkles className="h-4 w-4 text-accent" /> Describe your trip — let AI pick the ride
      </Button>
    );

  return (
    <div className="space-y-2 rounded-2xl border border-border p-3">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-accent" /> Trip assistant
      </p>
      <Textarea
        rows={2}
        maxLength={500}
        placeholder="e.g. 3 of us with 2 big bags going to the airport, paying from my wallet"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={ask} disabled={busy || text.trim().length < 3}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Suggest"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
      {result && (
        <div className="space-y-2 rounded-xl bg-secondary p-3 text-sm">
          <p>
            <span className="font-semibold">{VEHICLE_LABEL[result.vehicle]}</span> — {result.reason}
          </p>
          {(result.destination_name || result.destination_query) && (
            <p className="text-muted-foreground">To: {result.destination_name ?? result.destination_query}</p>
          )}
          {result.payment && <p className="text-muted-foreground">Pay with: {result.payment}</p>}
          {result.notes && <p className="text-muted-foreground">Note: {result.notes}</p>}
          <Button
            size="sm"
            className="w-full"
            onClick={async () => {
              await onApply(result);
              setOpen(false);
              setResult(null);
              setText("");
            }}
          >
            Use these booking details
          </Button>
        </div>
      )}
    </div>
  );
}
