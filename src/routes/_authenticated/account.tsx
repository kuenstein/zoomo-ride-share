import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Car,
  ChevronRight,
  Clock,
  Gauge,
  History,
  LogOut,
  MapPin,
  Shield,
  Star,
  Ticket,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { normalizePhMobile, formatPhMobile, PHONE_PLACEHOLDER } from "@/lib/locale";
import { setStoredMode, useAppMode } from "@/lib/nav";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Account — Zoomo" },
      { name: "description", content: "Manage your Zoomo profile, saved places, wallet and ride mode." },
      { property: "og:title", content: "Account — Zoomo" },
      { property: "og:description", content: "Manage your Zoomo profile, saved places, wallet and ride mode." },
    ],
  }),
  component: AccountPage,
});

function MenuLink({
  icon: Icon,
  label,
  hint,
  children,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  children: (content: React.ReactNode) => React.ReactNode;
}) {
  return (
    <>
      {children(
        <>
          <Icon className="h-5 w-5 text-accent" />
          <span className="flex-1">
            <span className="block text-sm font-medium">{label}</span>
            {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </>,
      )}
    </>
  );
}

const rowCls = "flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-secondary";

function AccountPage() {
  const { user, profile, roles, refresh, signOut, isDriver, isAdmin, driver } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const mode = useAppMode(pathname, isDriver);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setPhone(formatPhMobile(profile?.phone));
    setAvatar(profile?.avatar_url ?? "");
  }, [profile]);

  const save = async () => {
    if (!user) return;
    const normPhone = phone.trim() ? normalizePhMobile(phone) : null;
    if (phone.trim() && !normPhone) {
      toast.error("Enter a valid PH mobile number, e.g. 0917 123 4567");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, phone: normPhone, avatar_url: avatar || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Could not save your profile");
      return;
    }
    toast.success("Profile updated");
    await refresh();
  };

  const switchToDriver = async () => {
    if (!user) return;
    if (!isDriver) {
      const { error } = await supabase.from("user_roles").insert({ user_id: user.id, role: "driver" });
      if (error && !error.message.includes("duplicate")) {
        toast.error("Could not switch role");
        return;
      }
      await refresh();
    }
    setStoredMode("driver");
    toast.success(driver ? "Switched to driver mode" : "Driver mode unlocked — finish your setup");
    navigate({ to: "/driver" });
  };

  const switchToRider = () => {
    setStoredMode("rider");
    toast.success("Switched to rider mode");
    navigate({ to: "/ride" });
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Account</h1>
        <ThemeToggle />
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border p-4">
        <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-secondary text-xl font-bold">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            (profile?.full_name || user?.email || "Z").charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex-1">
          <p className="font-semibold">{profile?.full_name || "Zoomo user"}</p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
          <p className="mt-1 flex items-center gap-1 text-xs">
            <Star className="h-3 w-3 fill-accent text-accent" />
            {Number(profile?.rating ?? 5).toFixed(2)} ({profile?.rating_count ?? 0})
          </p>
        </div>
        <div className="flex flex-col gap-1">
          {roles.map((r) => (
            <Badge key={r} variant="secondary" className="capitalize">
              {r}
            </Badge>
          ))}
        </div>
      </div>

      <div className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border">
        {mode === "rider" ? (
          <>
            <MenuLink icon={MapPin} label="Saved places" hint="Home, Work and favourites">
              {(c) => <Link to="/places" className={rowCls}>{c}</Link>}
            </MenuLink>
            <MenuLink icon={Wallet} label="Wallet" hint="Balance and QR Ph top-ups">
              {(c) => <Link to="/wallet" className={rowCls}>{c}</Link>}
            </MenuLink>
            <MenuLink icon={Clock} label="Ride history" hint="Receipts and past trips">
              {(c) => <Link to="/activity" className={rowCls}>{c}</Link>}
            </MenuLink>
            <MenuLink icon={Ticket} label="Promo codes" hint="Check a code before you book">
              {(c) => <Link to="/promos" className={rowCls}>{c}</Link>}
            </MenuLink>
            <MenuLink
              icon={Gauge}
              label="Switch to driver mode"
              hint={driver ? "Go online and accept trips" : "Set up your vehicle to start earning"}
            >
              {(c) => <button onClick={switchToDriver} className={rowCls}>{c}</button>}
            </MenuLink>
          </>
        ) : (
          <>
            <MenuLink icon={Gauge} label="Driver dashboard" hint="Go online and accept trips">
              {(c) => <Link to="/driver" className={rowCls}>{c}</Link>}
            </MenuLink>
            <MenuLink icon={History} label="Trip history">
              {(c) => <Link to="/driver/trips" className={rowCls}>{c}</Link>}
            </MenuLink>
            <MenuLink icon={TrendingUp} label="Earnings and payouts">
              {(c) => <Link to="/driver/earnings" className={rowCls}>{c}</Link>}
            </MenuLink>
            <MenuLink icon={Wallet} label="Wallet">
              {(c) => <Link to="/wallet" className={rowCls}>{c}</Link>}
            </MenuLink>
            <MenuLink icon={Car} label="Switch to rider mode" hint="Book a ride yourself">
              {(c) => <button onClick={switchToRider} className={rowCls}>{c}</button>}
            </MenuLink>
          </>
        )}
        {isAdmin && (
          <MenuLink icon={Shield} label="Admin dashboard" hint="Drivers, rides, pricing and areas">
            {(c) => <Link to="/admin" className={rowCls}>{c}</Link>}
          </MenuLink>
        )}
      </div>

      <div className="mt-4 space-y-3 rounded-2xl border border-border p-4">
        <p className="font-semibold">Profile</p>
        <div className="space-y-2">
          <Label htmlFor="fn">Full name</Label>
          <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ph">Phone</Label>
          <Input id="ph" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={PHONE_PLACEHOLDER} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="av">Avatar URL</Label>
          <Input id="av" value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://…" />
        </div>
        <Button onClick={save} disabled={saving} className="w-full">
          Save changes
        </Button>
      </div>

      <Button
        variant="outline"
        className="mt-6 w-full"
        onClick={async () => {
          await signOut();
          navigate({ to: "/", replace: true });
        }}
      >
        <LogOut className="mr-2 h-4 w-4" /> Sign out
      </Button>
    </div>
  );
}
