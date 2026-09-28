import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, FileText, Trash2, UserPlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { deleteMyAccount } from "@/lib/account.functions";
import { normalizePhMobile, formatPhMobile, PHONE_PLACEHOLDER } from "@/lib/locale";
import { soundEnabled, setSoundEnabled, setPushPreferred, playRequestAlert, unlockAudio } from "@/lib/alerts";
import { disablePush, enablePush, isIos, isStandalone, pushSupported } from "@/lib/push-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function NotificationSettings({ userId }: { userId: string }) {
  const [push, setPush] = useState(false);
  const [sound, setSound] = useState(true);
  const [perm, setPerm] = useState<string>("default");
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSound(soundEnabled());
    setSupported(pushSupported());
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
    void navigator.serviceWorker?.getRegistration().then(async (r) => setPush(!!(await r?.pushManager.getSubscription())));
  }, []);

  const togglePush = async (on: boolean) => {
    if (on) {
      const r = await enablePush(userId);
      if (typeof Notification !== "undefined") setPerm(Notification.permission);
      if (!r.ok) {
        toast.error(r.reason === "denied" ? "Notifications are blocked in your browser settings" : "Couldn't turn on notifications");
        return;
      }
      toast.success("Notifications on");
    } else {
      await disablePush();
      toast.success("Notifications off");
    }
    setPushPreferred(on);
    setPush(on);
  };

  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-border p-4">
      <p className="flex items-center gap-2 font-semibold">
        <Bell className="h-4 w-4 text-accent" /> Notifications & sounds
      </p>
      <div className="flex items-center justify-between">
        <span className="text-sm">Push notifications</span>
        <Switch checked={push} onCheckedChange={(v) => void togglePush(v)} disabled={!supported} aria-label="Push notifications" />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm">Ride request sound & vibration</span>
        <Switch
          checked={sound}
          onCheckedChange={(v) => {
            setSound(v);
            setSoundEnabled(v);
            if (v) {
              unlockAudio();
              playRequestAlert();
            }
          }}
          aria-label="Sounds"
        />
      </div>
      {!supported && (
        <p className="text-xs text-muted-foreground">
          {isIos() && !isStandalone()
            ? "On iPhone: tap Share → Add to Home Screen, open Zoomo from your home screen, then turn on notifications here (iOS 16.4+)."
            : "Notifications work in the installed or published app, not in this preview window."}
        </p>
      )}
      {perm === "denied" && (
        <p className="text-xs text-destructive">
          Your browser is blocking notifications. Open site settings (the lock icon next to the address), allow Notifications, then reload.
        </p>
      )}
    </div>
  );
}

export function TrustedContacts({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const { data } = useQuery({
    queryKey: ["trusted-contacts", userId],
    queryFn: async () => (await supabase.from("trusted_contacts").select("*").order("created_at")).data ?? [],
  });
  const add = async () => {
    const p = normalizePhMobile(phone);
    if (!name.trim() || !p) return void toast.error("Enter a name and a valid PH mobile number");
    const { error } = await supabase.from("trusted_contacts").insert({ user_id: userId, name: name.trim().slice(0, 80), phone: p });
    if (error) return void toast.error("Couldn't save contact");
    setName("");
    setPhone("");
    toast.success("Trusted contact saved");
    await qc.invalidateQueries({ queryKey: ["trusted-contacts", userId] });
  };
  const remove = async (id: string) => {
    await supabase.from("trusted_contacts").delete().eq("id", id);
    await qc.invalidateQueries({ queryKey: ["trusted-contacts", userId] });
  };
  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-border p-4">
      <p className="flex items-center gap-2 font-semibold">
        <UserPlus className="h-4 w-4 text-accent" /> Trusted contacts
      </p>
      <p className="text-xs text-muted-foreground">Named in the trip details you share from the SOS screen.</p>
      {(data ?? []).map((c) => (
        <div key={c.id} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-sm">
          <span>
            {c.name} · {formatPhMobile(c.phone)}
          </span>
          <Button size="icon" variant="ghost" onClick={() => void remove(c.id)} aria-label={`Remove ${c.name}`}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder={PHONE_PLACEHOLDER} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <Button variant="outline" className="w-full" onClick={add}>
        Add contact
      </Button>
    </div>
  );
}

export function LegalAndDelete({ onDeleted }: { onDeleted: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const del = useServerFn(deleteMyAccount);
  const navigate = useNavigate();
  return (
    <div className="mt-4 space-y-2 rounded-2xl border border-border p-4">
      <p className="flex items-center gap-2 font-semibold">
        <FileText className="h-4 w-4 text-accent" /> Legal & privacy
      </p>
      <div className="flex gap-4 text-sm">
        <Link to="/terms" className="text-accent">Terms of Service</Link>
        <Link to="/privacy" className="text-accent">Privacy Policy</Link>
      </div>
      <Button variant="ghost" className="w-full justify-start text-destructive" onClick={() => setOpen(true)}>
        <Trash2 className="mr-2 h-4 w-4" /> Delete my account and data
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              Your profile, saved places, chats, trusted contacts and documents will be erased and you'll be signed out for good. Completed trips and
              payment records are kept for accounting with your name removed. Any wallet balance will be lost — request a payout first. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my account</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  const r = await del();
                  if (!r.ok) {
                    toast.error(r.error);
                    return;
                  }
                  toast.success("Your account was deleted");
                  await onDeleted();
                  void navigate({ to: "/", replace: true });
                } catch {
                  toast.error("Couldn't delete your account");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
