import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Car, Star, Wallet, ShieldCheck, Clock } from "lucide-react";
import heroImg from "@/assets/hero-bell-tower.png.asset.json";
import { Logo } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { homeForRoles } from "@/lib/nav";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Zoomo — Rides in Dumaguete, Padulong na ta!" },
      {
        name: "description",
        content:
          "Zoomo is Dumaguete's ride app — tricycle and motorcycle rides across Dumaguete City, Bacong, Sibulan and Valencia. Upfront peso fares, QR Ph or cash.",
      },
      { property: "og:title", content: "Zoomo — Rides in Dumaguete, Padulong na ta!" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content:
          "Zoomo is Dumaguete's ride app — tricycle and motorcycle rides across Dumaguete City, Bacong, Sibulan and Valencia. Upfront peso fares, QR Ph or cash.",
      },
    ],
  }),
  component: Landing,
});

const steps = [
  { icon: MapPin, title: "Set your pickup", text: "We find you automatically, or drop the pin yourself." },
  { icon: Car, title: "Pick your ride", text: "Tricycle or motorcycle (habal-habal) — fare in pesos, shown upfront." },
  { icon: Star, title: "Track and rate", text: "Watch your driver arrive live, then rate the trip." },
];

const perks = [
  { icon: Wallet, title: "Cash or QR Ph", text: "Top up your Zoomo wallet in pesos with QR Ph (GCash, Maya, any bank app) and pay in one tap." },
  { icon: ShieldCheck, title: "Verified drivers", text: "Every driver is reviewed and approved before going online." },
  { icon: Clock, title: "Fast matching", text: "Requests go to the closest online drivers within 5 km." },
];

function Landing() {
  const { user, roles, isAdmin } = useAuth();
  const appHome = homeForRoles(roles);
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" aria-label="Zoomo home">
            <Logo className="text-lg" />
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {user ? (
              <Button asChild size="sm">
                <Link to={appHome}>Open Zoomo</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="sm" variant="ghost">
                  <Link to="/auth">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/signup/rider">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <img
          src={heroImg.url}
          alt="Dumaguete bell tower at sunset"
          width={1680}
          height={945}
          className="absolute inset-0 h-full w-full object-cover opacity-70 dark:opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/80 to-background" />
        <div className="relative mx-auto max-w-5xl px-4 py-24 sm:py-32">
          <p className="inline-flex rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
            Padulong na ta! · Dumaguete City
          </p>
          <h1 className="mt-4 max-w-xl text-5xl font-bold leading-[1.05] sm:text-6xl">
            Dumaguete,
            <br />
            <span className="text-accent">one tap away.</span>
          </h1>
          <p className="mt-5 max-w-md text-base text-muted-foreground">
            Tricycle or habal-habal — booked in seconds with upfront peso fares and
            live tracking. Serving Dumaguete City, Bacong, Sibulan and Valencia. Tara, sakay na!
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              {/* Signed-out users are sent to sign in and returned to booking afterwards */}
              <Link to="/ride">Book a ride</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              {user ? <Link to="/driver">Drive with Zoomo</Link> : <Link to="/signup/driver">Become a driver</Link>}
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 id="how-it-works" className="scroll-mt-20 text-3xl font-bold">How it works</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-6">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-4 text-xs font-semibold text-muted-foreground">STEP {i + 1}</p>
              <h3 className="mt-1 text-lg font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16">
        <div className="grid gap-4 sm:grid-cols-3">
          {perks.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl bg-secondary p-6">
              <Icon className="h-5 w-5 text-accent" />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16">
        <h2 id="about" className="scroll-mt-20 text-3xl font-bold">Where we ride</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Asa ka padulong? Zoomo currently covers these towns in Negros Oriental — more soon.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_1.4fr]">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-1">
            {["Dumaguete City", "Bacong", "Sibulan", "Valencia"].map((t) => (
              <li key={t} className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 font-semibold">
                <MapPin className="h-4 w-4 text-accent" /> {t}
              </li>
            ))}
          </ul>
          <iframe
            title="Zoomo coverage map: Dumaguete, Bacong, Sibulan and Valencia"
            className="h-72 w-full rounded-2xl border border-border sm:h-full"
            loading="lazy"
            src="https://www.openstreetmap.org/export/embed.html?bbox=123.19%2C9.22%2C123.35%2C9.39&layer=mapnik&marker=9.3068%2C123.3054"
          />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-20">
        <div className="rounded-3xl bg-ink p-8 text-ink-foreground sm:p-12">
          <h2 className="max-w-md text-3xl font-bold">
            Drive with Zoomo. Keep <span className="text-accent">85%</span> of every fare.
          </h2>
          <p className="mt-3 max-w-md text-sm opacity-80">
            Drive a tricycle or motorcycle — sign up with your LTO license and OR/CR, get approved, and go online whenever you want. Earnings land
            in your wallet the moment a trip ends.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link to="/signup/driver">Start driving</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <Logo className="text-base text-foreground" />
          <p>© {new Date().getFullYear()} Zoomo. Proudly from Dumaguete, Negros Oriental.</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-4">
            <Link to="/" hash="about" className="hover:text-foreground">About</Link>
            <Link to="/" hash="how-it-works" className="hover:text-foreground">How it works</Link>
            <Link to="/signup/driver" className="hover:text-foreground">Become a driver</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            {user ? (
              <Link to={appHome} className="font-medium text-accent">Open app</Link>
            ) : (
              <Link to="/auth" className="font-medium text-accent">Sign in</Link>
            )}
            {isAdmin && <Link to="/admin" className="hover:text-foreground">Admin</Link>}
          </nav>
        </div>
      </footer>
    </div>
  );
}
