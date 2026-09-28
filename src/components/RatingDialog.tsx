import { useState } from "react";
import { Star } from "lucide-react";
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
    if (allowTip && tip > 0) {
      const { error: tipErr } = await supabase
        .from("rides")
        .update({ tip })
        .eq("id", rideId);
      if (tipErr) toast.error("Tip could not be added");
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
        <Textarea
          placeholder="Leave a comment (optional)"
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
                  onClick={() => setTip(t)}
                >
                  {t === 0 ? "No tip" : `₱${t}`}
                </Button>
              ))}
            </div>
          </div>
        )}
        <Button onClick={submit} disabled={busy} className="w-full">
          Submit
        </Button>
      </DialogContent>
    </Dialog>
  );
}
