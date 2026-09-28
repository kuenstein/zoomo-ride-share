import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { normalizePhMobile, PHONE_PLACEHOLDER } from "@/lib/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Checkbox } from "@/components/ui/checkbox";
import { CONSENT_VERSION } from "@/lib/legal";

export function SignupForm({ role, redirect }: { role: "rider" | "driver"; redirect?: string | undefined }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [agree, setAgree] = useState(false);
  const isDriver = role === "driver";
  const home = isDriver ? "/driver" : (redirect ?? "/ride");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) {
      toast.error("Please agree to the Terms and Privacy Policy");
      return;
    }
    setBusy(true);
    try {
      const normPhone = phone.trim() ? normalizePhMobile(phone) : null;
      if (!normPhone) throw new Error("Enter a valid PH mobile number, e.g. 0917 123 4567");
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${home}`,
          data: { full_name: fullName, phone: normPhone, role, consent_version: CONSENT_VERSION },
        },
      });
      if (error) throw error;
      if (!data.session) {
        setSent(true);
        toast.success("Check your email to confirm your account.");
      } else {
        toast.success(isDriver ? "Welcome! Let's set up your vehicle." : "Welcome to Zoomo!");
        navigate({ href: home });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    if (!agree) {
      toast.error("Please agree to the Terms and Privacy Policy first");
      return;
    }
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/auth?redirect=${encodeURIComponent(home)}` });
    if (result.error) {
      setBusy(false);
      toast.error("Google sign-in failed. Try again.");
      return;
    }
    if (result.redirected) return;
    navigate({ href: home });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between p-4">
        <Link to="/">
          <Logo className="text-lg" />
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">
          {isDriver ? "Drive with Zoomo" : "Ride with Zoomo"}
        </p>
        <h1 className="mt-1 text-3xl font-bold">{isDriver ? "Become a driver" : "Create your rider account"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isDriver
            ? "Sign up, then add your vehicle, OR/CR and LTO license for approval."
            : "Book tricycles, motorcycles and cars around Dumaguete."}
        </p>

        {sent ? (
          <Card className="mt-6">
            <CardContent className="space-y-3 pt-6 text-center">
              <p className="font-semibold">Confirm your email</p>
              <p className="text-sm text-muted-foreground">We sent a link to {email}. Click it, then sign in.</p>
              <Button asChild variant="outline">
                <Link to="/auth">Go to sign in</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">PH mobile number</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={PHONE_PLACEHOLDER}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} className="mt-0.5" aria-label="Agree to terms" />
                <span className="text-muted-foreground">
                  I agree to the{" "}
                  <Link to="/terms" target="_blank" className="font-semibold text-accent">Terms of Service</Link> and{" "}
                  <Link to="/privacy" target="_blank" className="font-semibold text-accent">Privacy Policy</Link>, including the use of my location during trips.
                </span>
              </label>
              <Button type="submit" className="w-full" disabled={busy || !agree}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : isDriver ? "Create driver account" : "Create account"}
              </Button>
            </form>
            {!isDriver && (
              <>
                <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
                </div>
                <Button variant="outline" className="w-full" onClick={google} disabled={busy}>
                  Continue with Google
                </Button>
              </>
            )}
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/auth" search={{ redirect }} className="font-semibold text-accent">
                Sign in
              </Link>
            </p>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {isDriver ? "Just need a ride? " : "Want to earn? "}
              <Link to={isDriver ? "/signup/rider" : "/signup/driver"} className="font-semibold text-accent">
                {isDriver ? "Sign up as a rider" : "Sign up as a driver"}
              </Link>
            </p>
          </>
        )}
      </main>
    </div>
  );
}
