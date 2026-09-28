import { useState } from "react";
import { toast } from "sonner";
import { Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const REPORT_CATEGORIES = [
  { value: "overcharge", label: "Overcharged" },
  { value: "rude", label: "Rude behavior" },
  { value: "unsafe_driving", label: "Unsafe driving" },
  { value: "lost_item", label: "Lost item" },
  { value: "other", label: "Other" },
] as const;

export function reportCategoryLabel(v: string) {
  return REPORT_CATEGORIES.find((c) => c.value === v)?.label ?? v;
}

export function ReportProblem({ rideId, userId, className }: { rideId: string; userId: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState<string>("overcharge");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!details.trim()) return toast.error("Tell us what happened");
    setBusy(true);
    const { error } = await supabase.from("reports").insert({
      ride_id: rideId,
      reporter_id: userId,
      category: cat,
      details: details.trim().slice(0, 2000),
    });
    setBusy(false);
    if (error) return toast.error("Couldn't send your report");
    toast.success("Report sent — our team will follow up");
    setOpen(false);
    setDetails("");
  };

  return (
    <>
      <Button variant="outline" className={className} onClick={() => setOpen(true)}>
        <Flag className="mr-2 h-4 w-4" /> Report a problem
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report a problem</DialogTitle>
            <DialogDescription>Only you and the Zoomo team can see this report.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {REPORT_CATEGORIES.map((c) => (
              <Button key={c.value} size="sm" variant={cat === c.value ? "default" : "outline"} onClick={() => setCat(c.value)}>
                {c.label}
              </Button>
            ))}
          </div>
          <Textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="What happened?"
          />
          <DialogFooter>
            <Button onClick={submit} disabled={busy}>
              Send report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
