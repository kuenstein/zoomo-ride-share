import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CONSENT_VERSION } from "@/lib/legal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** One-time dialog asking existing users to accept the current Terms and Privacy Policy. */
export function ConsentGate() {
  const { profile, refresh, signOut, loading } = useAuth();
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const needs = !loading && !!profile && profile.consent_version !== CONSENT_VERSION;

  const accept = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("accept_terms", { _version: CONSENT_VERSION });
    setBusy(false);
    if (error) return toast.error("Couldn't save — try again");
    await refresh();
    toast.success("Thanks!");
  };

  return (
    <Dialog open={needs}>
      <DialogContent className="[&>button]:hidden" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>We've updated our terms</DialogTitle>
          <DialogDescription>
            To keep using Zoomo, please review and accept our Terms of Service and Privacy Policy (Data Privacy Act of 2012).
          </DialogDescription>
        </DialogHeader>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} className="mt-0.5" aria-label="Agree" />
          <span className="text-muted-foreground">
            I agree to the{" "}
            <Link to="/terms" target="_blank" className="font-semibold text-accent">Terms</Link> and{" "}
            <Link to="/privacy" target="_blank" className="font-semibold text-accent">Privacy Policy</Link>.
          </span>
        </label>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => void signOut()}>
            Sign out
          </Button>
          <Button className="flex-1" disabled={!agree || busy} onClick={accept}>
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
