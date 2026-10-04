import { createFileRoute, Link } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { Logo } from "@/components/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/whitepaper")({
  head: () => ({
    meta: [
      { title: "Product Whitepaper & Beta Readiness Overview — Zoomo" },
      { name: "description", content: "Zoomo's product whitepaper and beta readiness overview for tricycle and motorcycle rides in Dumaguete and nearby towns." },
      { property: "og:title", content: "Product Whitepaper & Beta Readiness Overview — Zoomo" },
      { property: "og:description", content: "How Zoomo works, what its Dumaguete beta aims to test, and what remains before public launch." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WhitepaperPage,
});

const pricing = [
  ["Tricycle", "₱20 (admin-configurable)", "₱20 / km", "₱20"],
  ["Motorcycle (habal-habal)", "₱20 (admin-configurable)", "₱20 / km", "₱20"],
];

const limitations = [
  ["Push notifications", "Pending activation", "Keep the app open/foregrounded to catch new requests."],
  ["Map & address search", "Using a free-tier mapping service", "Fine for beta traffic; a paid provider is needed before public launch."],
  ["Terms & Privacy pages", "Template text, not yet reviewed by a lawyer", "Do not treat as final legal copy."],
  ["Driver supply", "Small pool of approved test drivers", "Matching times in beta won't reflect a real launch."],
];

function WhitepaperPage() {
  return (
    <div className="whitepaper-print min-h-screen bg-background text-foreground">
      <header className="print-hidden border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/" aria-label="Zoomo home"><Logo className="text-lg" /></Link>
          <div className="flex items-center gap-2">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Back to Zoomo</Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:pt-14">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-5 border-b border-border pb-8">
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase text-accent">Zoomo · Whitepaper</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">Zoomo — Product Whitepaper &amp; Beta Readiness Overview</h1>
            <p className="mt-4 text-base italic leading-relaxed text-muted-foreground">A localized tricycle &amp; motorcycle ride-hailing platform for Dumaguete City, Bacong, Sibulan and Valencia, Negros Oriental, Philippines</p>
          </div>
          <Button variant="outline" className="print-hidden shrink-0" onClick={() => window.print()}>
            <Printer aria-hidden="true" className="mr-2 h-4 w-4" />Print / Save as PDF
          </Button>
        </div>
        <p className="mb-10 text-sm text-muted-foreground"><strong className="text-foreground">Document status:</strong> Internal / Beta — not for public distribution · <strong className="text-foreground">Date:</strong> October 2026 · <strong className="text-foreground">Version:</strong> 1.1 (Beta)</p>

        <article className="whitepaper-body space-y-5 text-[15px] leading-7 [&_h2]:pt-7 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:pt-3 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:pl-1 [&_li]:marker:text-accent [&_p]:text-foreground">
          <h2>1. Executive summary</h2>
          <p>Zoomo is a mobile-first ride-hailing platform built for the two vehicle types that actually move people around Dumaguete: the tricycle and the motorcycle (habal-habal). It connects riders who need a short, local trip with nearby drivers, handles fare calculation and payment, and gives a solo admin the tools to run the service without manual dispatching.</p>
          <p>This document describes what has been built, how it works, what is and is not ready, and what the beta test is meant to validate before a public launch.</p>
          <ul className="list-disc space-y-2 pl-5">
            <li><strong>Coverage:</strong> Dumaguete City, Bacong, Sibulan and Valencia, with bookings blocked outside these four areas.</li>
            <li><strong>Vehicles:</strong> Tricycle and Motorcycle (habal-habal) only — no car, van or multicab tiers.</li>
            <li><strong>Pricing:</strong> Distance-based (base fare + per-kilometer rate), set independently per vehicle type by the admin.</li>
            <li><strong>Payments:</strong> Cash only during the open beta.</li>
            <li><strong>Beta funding:</strong> No driver commission during the beta — the app is supported by optional donations.</li>
            <li><strong>Status:</strong> Functionally complete for a controlled beta; several production-readiness items remain open (Section 9).</li>
          </ul>

          <h2>2. The problem</h2>
          <p>In Dumaguete and the surrounding towns, tricycle and habal-habal trips are still arranged the way they have been for years: flagging a driver down on the street, or calling around a personal network of drivers. That works, but it has real friction:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>No upfront price — fares are negotiated trip by trip.</li>
            <li>No way to request a ride from indoors, at night, or when no tricycle happens to be passing by.</li>
            <li>Drivers have no central way to see demand — they wait in queues at terminals or drive around hoping to find a fare.</li>
            <li>No trip record, no rating, no accountability if something goes wrong.</li>
          </ul>
          <p>Zoomo is not trying to replace the tricycle and habal-habal — it is trying to make them bookable, priced, and trackable, the way commuters already expect from any app-based service.</p>

          <h2>3. Who it's for</h2>
          <p><strong>Riders</strong> — Commuters, students (Silliman University is in the core service area) and visitors who want to book a tricycle or motorcycle trip from their phone, see the fare before they ride, and track the driver on the way.</p>
          <p><strong>Drivers</strong> — Tricycle and habal-habal drivers who want a steady stream of fare requests without waiting at a terminal, plus a simple record of their daily and weekly earnings.</p>
          <p><strong>The operator (admin)</strong> — A single owner-operator who needs to approve drivers, set pricing, monitor rides, handle safety reports, and manage payouts, without hiring a dispatch team.</p>

          <h2>4. How a ride works</h2>
          <p><strong>4.1 Booking</strong> — The rider sets a pickup (current location, dragged pin, searched address, a saved place, or a community pin) and a destination the same way. The app shows a fare and distance estimate for Tricycle and Motorcycle before the rider commits. The rider chooses how the request is sent: "Any available driver" broadcasts to every eligible online driver nearby, first to accept gets it; "Choose your driver" lets the rider browse nearby online drivers (name, photo, rating, vehicle, distance) and send the request to one driver only, who gets 45 seconds to accept.</p>
          <p><strong>4.2 Matching</strong> — Drivers who are online, approved, and within the matching radius see open requests on an Available Rides board, sorted by distance, with live updates as requests appear, get taken, or expire. A direct request is hidden from every other driver while pending. Acceptance is atomic, and a driver already on a trip cannot see or accept another one.</p>
          <p><strong>4.3 The trip</strong> — The rider sees the driver's live position, name, rating, vehicle and plate, with status steps and in-app chat that opens only while the trip is active. A rider cannot cancel once their driver is within 1 kilometer of pickup; if a driver cancels, the rider gets an unmistakable alert with the reason and a one-tap way to rebook.</p>
          <p><strong>4.4 Payment and rating</strong> — On completion, the rider pays the driver directly in cash, and both sides rate each other.</p>

          <h2>5. Platform features</h2>
          <p><strong>Rider:</strong> Map-based booking with address search, quick-pick landmarks, saved places, and shareable community pins · Upfront, distance-based fare estimates · Any-driver or choose-your-driver booking modes · Live trip tracking, in-trip chat, SOS button, and post-trip "report a problem" · Ride history, receipts, ratings, tips and promo codes.</p>
          <p><strong>Driver:</strong> Onboarding with license and vehicle-document verification · Online/offline toggle, live location sharing, Available Rides board · Read-only "riders in your area" view · Trip flow controls and in-trip chat · Earnings dashboard and trip history.</p>
          <p><strong>Admin:</strong> Driver approval and document review · service-area and pricing configuration per vehicle type · Ride, user, promo code, payout, safety-incident and report oversight · Community-pin moderation and a launch-readiness checklist.</p>

          <h2>6. Technology and trust</h2>
          <p><strong>6.1 Architecture</strong> — Zoomo runs on a Lovable Cloud backend: Postgres for data, Supabase Auth for sign-in, and Supabase Realtime for live ride, location and chat updates. Mapping uses Leaflet with OpenStreetMap tiles and Nominatim/OSRM for search and routing, proxied through the app's own server.</p>
          <p><strong>6.2 Data protection</strong> — Row-level security is enabled on every table. Money-moving logic runs through server-side functions rather than client code. Signup can only create a rider or driver account — admin access is granted by the operator directly, never through the sign-up form.</p>
          <p><strong>6.3 Safety</strong> — An SOS button during active trips with one-tap access to 911 and the Philippine Red Cross (143) · Driver document verification before approval, with license-expiry checks · A cancellation guardrail at 1 km with clear driver-cancellation notice · Post-trip reporting reviewed by the admin.</p>
          <p><strong>6.4 Payments</strong> — Wallet top-ups go through PayMongo using QR Ph. A wallet is only credited after PayMongo's webhook confirms payment, with signature verification so a top-up can never be credited twice.</p>

          <h2>7. Pricing model</h2>
          <p>Fare = base fare + (per-kilometer rate × distance), rounded to the nearest peso, with a minimum fare floor. There is no per-minute charge. Each vehicle type has its own independently configurable rates, plus its own flat airport fare.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
              <thead><tr className="border-b-2 border-border bg-secondary"><th scope="col" className="p-3">Vehicle type</th><th scope="col" className="p-3">Base fare</th><th scope="col" className="p-3">Per km</th><th scope="col" className="p-3">Minimum fare</th></tr></thead>
              <tbody>{pricing.map(([type, base, perKm, minimum]) => <tr key={type} className="border-b border-border"><th scope="row" className="p-3 font-medium">{type}</th><td className="p-3">{base}</td><td className="p-3">{perKm}</td><td className="p-3">{minimum}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="text-sm italic text-muted-foreground">Beta defaults as of this writing — adjustable at any time from the admin Pricing tab, independently per vehicle type.</p>
          <p>The platform commission (currently 5% of each completed fare, admin-adjustable) is deducted from the driver's earnings on wallet payments, and debited directly from the driver's wallet on cash payments.</p>

          <h2>8. What the beta is meant to test</h2>
          <p>This beta exists to validate the core loop, inquiry to confirmed, completed, paid trip, with real people, real phones, and real Dumaguete streets:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Whether riders can get matched with a driver in a reasonable time using both booking modes</li>
            <li>Whether the distance-based fares feel fair compared to today's negotiated tricycle/habal-habal rates</li>
            <li>Whether GPS accuracy holds up for drivers and riders moving around town</li>
            <li>Whether the cancellation guardrail and driver-cancellation notice feel fair to both sides</li>
            <li>Whether QR Ph top-ups complete successfully once PayMongo is activated</li>
            <li>Whether the SOS and report-a-problem flows are easy to find and use when actually needed</li>
          </ul>
          <p><strong>Feedback channel:</strong> testers can use the in-app "Report a problem" action after any trip; the admin reviews all reports and safety incidents from the Admin dashboard.</p>

          <h2>9. Known limitations before a public launch</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <thead><tr className="border-b-2 border-border bg-secondary"><th scope="col" className="p-3">Area</th><th scope="col" className="p-3">Status at beta launch</th><th scope="col" className="p-3">What this means for testers</th></tr></thead>
              <tbody>{limitations.map(([area, status, impact]) => <tr key={area} className="border-b border-border"><th scope="row" className="p-3 font-medium">{area}</th><td className="p-3">{status}</td><td className="p-3">{impact}</td></tr>)}</tbody>
            </table>
          </div>

          <h2>10. Roadmap beyond this beta</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>SMS notifications alongside in-app push</li>
            <li>A paid, production-grade maps provider</li>
            <li>Lawyer review of the Terms of Service and Privacy Policy (Data Privacy Act of 2012 compliance)</li>
            <li>Expanded driver supply and a formal driver-recruitment flow</li>
            <li>Live PayMongo activation for QR Ph, and a review of the platform commission rate</li>
          </ul>

          <h2>11. Closing note</h2>
          <p>Zoomo's goal is narrow and deliberate: make booking a tricycle or habal-habal in Dumaguete as easy as booking anything else on a phone, without losing the local character of how people actually get around this city.</p>
        </article>
      </main>
    </div>
  );
}