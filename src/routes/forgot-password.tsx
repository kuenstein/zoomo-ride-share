import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — Zoomo" },
      { name: "description", content: "Get a link to reset your Zoomo account password." },
      { property: "og:title", content: "Reset your password — Zoomo" },
      { property: "og:description", content: "Get a link to reset your Zoomo account password." },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("Reset link sent");
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
        <Link to="/auth" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
        {sent ? (
          <div className="rounded-2xl border border-border p-6 text-center">
            <MailCheck className="mx-auto h-10 w-10 text-accent" />
            <p className="mt-3 font-semibold">Check your inbox</p>
            <p className="mt-1 text-sm text-muted-foreground">
              If {email} has a Zoomo account, you'll get a link to set a new password.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/auth">Back to sign in</Link>
            </Button>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold">Forgot password?</h1>
            <p className="mt-1 text-sm text-muted-foreground">Enter your email and we'll send you a reset link.</p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
              </Button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
