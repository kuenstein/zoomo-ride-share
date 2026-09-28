import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";
import { fetchHome, safeRedirect } from "@/lib/nav";

type AuthSearch = { redirect?: string | undefined };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): AuthSearch => ({ redirect: safeRedirect(s["redirect"]) }),
  head: () => ({
    meta: [
      { title: "Sign in — Zoomo" },
      { name: "description", content: "Sign in to Zoomo to book rides around Dumaguete or drive and earn." },
      { property: "og:title", content: "Sign in — Zoomo" },
      { property: "og:description", content: "Sign in to Zoomo to book rides around Dumaguete or drive and earn." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const routed = useRef(false);

  const goIn = async (userId: string) => {
    if (routed.current) return;
    routed.current = true;
    if (redirect) {
      navigate({ href: redirect, replace: true });
      return;
    }
    navigate({ to: await fetchHome(userId), replace: true });
  };

  // Signed-in users (or returning from Google) go straight into the app.
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void goIn(data.session.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && event === "SIGNED_IN") void goIn(session.user.id);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Welcome back!");
      await goIn(data.user.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const back = redirect ? `?redirect=${encodeURIComponent(redirect)}` : "";
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth${back}`,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Google sign-in failed. Try again.");
      return;
    }
    if (result.redirected) return;
    const { data } = await supabase.auth.getSession();
    if (data.session) await goIn(data.session.user.id);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between p-4">
        <Link to="/" aria-label="Zoomo home">
          <Logo className="text-lg" />
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-10">
        <h1 className="text-3xl font-bold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {redirect ? "Sign in to continue where you left off." : "Sign in to book or drive."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to="/forgot-password" className="text-xs font-medium text-accent">
                Forgot password?
              </Link>
            </div>
            <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" className="w-full" onClick={google} disabled={busy}>
          Continue with Google
        </Button>

        <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
          <p>New to Zoomo?</p>
          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline">
              <Link to="/signup/rider" search={{ redirect }}>Sign up to ride</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/signup/driver">Sign up to drive</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
