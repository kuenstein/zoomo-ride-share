import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CONSENT_VERSION } from "@/lib/legal";

export function LegalLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between p-4">
        <Link to="/">
          <Logo className="text-lg" />
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16">
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <strong>Template:</strong> This document is a starting draft and must be reviewed by a Philippine lawyer before Zoomo launches.
        </div>
        <h1 className="mt-6 text-3xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Version {CONSENT_VERSION}</p>
        <article className="mt-6 space-y-4 text-sm leading-relaxed [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc">
          {children}
        </article>
        <p className="mt-10 text-sm text-muted-foreground">
          See also: <Link to="/terms" className="text-accent">Terms of Service</Link> ·{" "}
          <Link to="/privacy" className="text-accent">Privacy Policy</Link>
        </p>
      </main>
    </div>
  );
}
