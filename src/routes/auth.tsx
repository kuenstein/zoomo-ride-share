import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Loader2, Car, CarTaxiFront } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Zoomo" },
      { name: "description", content: "Create a Zoomo account or sign in to book rides and drive." },
      { property: "og:title", content: "Sign in — Zoomo" },
      { property: "og:description", content: "Create a Zoomo account or sign in to book rides and drive." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"rider" | "driver">("rider");
  const [busy, setBusy] = useState(false);
  const [sentConfirm, setSentConfirm] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) navigate({ to: "/ride" });
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        navigate({ to: "/ride" });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, phone, role },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSentConfirm(true);
          toast.success("Check your email to confirm your account.");
        } else {
          toast.success("Welcome to Zoomo!");
          navigate({ to: role === "driver" ? "/driver" : "/ride" });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate({ to: "/ride" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Google sign-in failed. Try again.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/ride" });
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
        <h1 className="text-3xl font-bold">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin" ? "Sign in to book or drive." : "Ride or drive — you choose."}
        </p>

        {sentConfirm ? (
          <Card className="mt-6">
            <CardContent className="space-y-3 pt-6 text-center">
              <p className="font-semibold">Confirm your email</p>
              <p className="text-sm text-muted-foreground">
                We sent a confirmation link to {email}. Click it, then come back and sign in.
              </p>
              <Button variant="outline" onClick={() => { setSentConfirm(false); setMode("signin"); }}>
                Back to sign in
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <form onSubmit={submit} className="mt-6 space-y-4">
              {mode === "signup" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 000 1234" />
                  </div>
                  <div className="space-y-2">
                    <Label>I want to</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["rider", "driver"] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRole(r)}
                          className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors ${
                            role === r ? "border-accent bg-accent/10 text-foreground" : "border-border text-muted-foreground"
                          }`}
                        >
                          {r === "rider" ? <Car className="h-4 w-4" /> : <CarTaxiFront className="h-4 w-4" />}
                          {r === "rider" ? "Ride" : "Drive"}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>

            <Button variant="outline" className="w-full" onClick={google} disabled={busy}>
              Continue with Google
            </Button>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "signin" ? "New to Zoomo?" : "Already have an account?"}{" "}
              <button
                className="font-semibold text-accent"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin" ? "Create account" : "Sign in"}
              </button>
            </p>
          </>
        )}
      </main>
    </div>
  );
}
