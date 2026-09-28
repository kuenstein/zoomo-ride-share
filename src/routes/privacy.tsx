import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/LegalLayout";
import { LEGAL_ENTITY, PRIVACY_CONTACT_EMAIL } from "@/lib/legal";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Zoomo" },
      { name: "description", content: "How Zoomo collects, uses and protects your personal data under the Philippine Data Privacy Act of 2012." },
      { property: "og:title", content: "Privacy Policy — Zoomo" },
      { property: "og:description", content: "How Zoomo handles your personal data under the Data Privacy Act of 2012." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <p>
        {LEGAL_ENTITY} ("Zoomo", "we") runs a ride-hailing service for tricycle and motorcycle (habal-habal) trips in Dumaguete City,
        Bacong, Sibulan and Valencia, Negros Oriental. This policy explains how we process personal data in line with Republic Act No.
        10173, the Data Privacy Act of 2012 (DPA), its Implementing Rules and Regulations, and issuances of the National Privacy Commission (NPC).
      </p>

      <h2>1. What we collect</h2>
      <ul>
        <li>Account details: name, mobile number, email address, profile photo.</li>
        <li>Precise location: pickup and drop-off points, and your live location while you book, while a trip is active, and (for drivers) while online.</li>
        <li>Trip history: routes, distance, fares, tips, ratings, feedback and reports.</li>
        <li>Chat messages exchanged with your rider or driver during a trip.</li>
        <li>Driver documents: LTO driver's license, OR/CR, vehicle photo with plate, selfie, license number and expiry.</li>
        <li>Payment records: wallet balance, top-ups, payouts and transaction references. Card and e-wallet details are handled by PayMongo, not stored by Zoomo.</li>
        <li>Safety records: SOS alerts, their location, and trusted contacts you save.</li>
        <li>Device data: browser type and push notification tokens if you enable notifications.</li>
      </ul>

      <h2>2. Why we use it</h2>
      <ul>
        <li>To match riders with nearby drivers, calculate fares, and complete trips (performance of contract).</li>
        <li>To verify drivers and keep riders safe, respond to SOS alerts and investigate reports (legitimate interest and legal obligation).</li>
        <li>To process payments, prevent fraud and keep accounting records (legal obligation).</li>
        <li>To send service notifications you have enabled (consent).</li>
      </ul>

      <h2>3. Who can see it</h2>
      <ul>
        <li>Riders and drivers see each other's name, photo, rating, vehicle and live location only during an assigned trip.</li>
        <li>Authorized Zoomo administrators, for support, safety, verification and accounting.</li>
        <li>PayMongo processes wallet top-ups. Map providers receive addresses and coordinates to search and route trips.</li>
        <li>Government authorities when required by law or a lawful order.</li>
      </ul>
      <p>We do not sell your personal data.</p>

      <h2>4. How long we keep it</h2>
      <ul>
        <li>Account data: while your account is active. When you delete your account, profile data, saved places, chats and documents are erased.</li>
        <li>Completed trip and payment records: kept with your identity anonymized for up to 10 years for tax and accounting requirements.</li>
        <li>Live location updates are overwritten continuously; safety records are kept as long as needed to resolve an incident.</li>
      </ul>

      <h2>5. Your rights under the DPA</h2>
      <ul>
        <li>Be informed about how your data is processed.</li>
        <li>Access a copy of your personal data.</li>
        <li>Correct inaccurate data (you can edit your profile in the app).</li>
        <li>Erase or block your data — use "Delete my account and data" in your Account page.</li>
        <li>Object to processing, and withdraw consent where processing is based on consent.</li>
        <li>Data portability, and to be indemnified for damages.</li>
        <li>File a complaint with the National Privacy Commission (privacy.gov.ph).</li>
      </ul>

      <h2>6. Security</h2>
      <p>
        We use access controls so users only see their own data, encrypted connections, private storage with short-lived links for driver
        documents, and restricted admin access. No system is perfectly secure; we will notify the NPC and affected users of breaches as required by law.
      </p>

      <h2>7. Contact our Data Protection Officer</h2>
      <p>
        Email: <a className="text-accent" href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a> (placeholder — replace before launch).
      </p>
    </LegalLayout>
  );
}
