import { useState } from "react";
import { Star, ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function RatingDialog({
  open,
  onOpenChange,
  rideId,
  raterId,
  rateeId,
  title,
  allowTip = false,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rideId: string;
  raterId: string;
  rateeId: string;
  title: string;
  allowTip?: boolean;
  onDone?: () => void;
}) {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [tip, setTip] = useState(0);
  const [customTip, setCustomTip] = useState("");
  const [sentiment, setSentiment] = useState<"like" | "dislike" | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("ratings")
      .insert({ ride_id: rideId, rater_id: raterId, ratee_id: rateeId, stars, comment: comment || null });
    if (error && !error.message.includes("duplicate")) {
      setBusy(false);
      toast.error("Could not save your rating");
      return;
    }
    if (allowTip && sentiment) {
      const { error: fbErr } = await supabase.from("driver_feedback").insert({
        ride_id: rideId,
        rider_id: raterId,
        driver_id: rateeId,
        sentiment,
        comment: comment || null,
      });
      if (fbErr && !fbErr.message.includes("duplicate")) toast.error("Feedback could not be sent");
    }
    const tipAmount = customTip !== "" ? Math.round(Number(customTip)) : tip;
    if (allowTip && tipAmount > 0) {
      const { data, error: tipErr } = await supabase.rpc("add_tip", { _ride_id: rideId, _amount: tipAmount });
      const res = data as unknown as { success: boolean; message?: string } | null;
      if (tipErr || !res?.success) toast.error(res?.message ?? "Tip could not be added");
      else toast.success(`₱${tipAmount} tip sent — salamat!`);
    }
    setBusy(false);
    toast.success("Thanks for the feedback!");
    onOpenChange(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Your feedback keeps Zoomo great.</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setStars(n)} aria-label={`${n} stars`}>
              <Star
                className={`h-8 w-8 ${n <= stars ? "fill-accent text-accent" : "text-muted-foreground"}`}
              />
            </button>
          ))}
        </div>
        {allowTip && (
          <div className="flex justify-center gap-3">
            <Button type="button" variant={sentiment === "like" ? "default" : "outline"} onClick={() => setSentiment(sentiment === "like" ? null : "like")}>
              <ThumbsUp className="mr-1 h-4 w-4" /> Like
            </Button>
            <Button type="button" variant={sentiment === "dislike" ? "destructive" : "outline"} onClick={() => setSentiment(sentiment === "dislike" ? null : "dislike")}>
              <ThumbsDown className="mr-1 h-4 w-4" /> Dislike
            </Button>
          </div>
        )}
        <Textarea
          placeholder={allowTip ? "Tell us about your driver (sent to Zoomo support)" : "Leave a comment (optional)"}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        {allowTip && (
          <div>
            <p className="mb-2 text-sm font-medium">Add a tip</p>
            <div className="flex gap-2">
              {[0, 20, 50, 100].map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant={tip === t ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setTip(t); setCustomTip(""); }}
                >
                  {t === 0 ? "No tip" : `₱${t}`}
                </Button>
              ))}
            </div>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={1000}
              placeholder="Custom tip (₱)"
              value={customTip}
              onChange={(e) => setCustomTip(e.target.value)}
              className="mt-2 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            />
          </div>
        )}
        <Button onClick={submit} disabled={busy} className="w-full">
          Submit
        </Button>
      </DialogContent>
    </Dialog>
  );
}
