import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/LegalLayout";
import { LEGAL_ENTITY, PRIVACY_CONTACT_EMAIL } from "@/lib/legal";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Zoomo" },
      { name: "description", content: "The rules for riding and driving with Zoomo in Dumaguete, Bacong, Sibulan and Valencia." },
      { property: "og:title", content: "Terms of Service — Zoomo" },
      { property: "og:description", content: "The rules for riding and driving with Zoomo in Negros Oriental." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalLayout title="Terms of Service">
      <p>
        These Terms govern your use of Zoomo, operated by {LEGAL_ENTITY}, a platform connecting riders with independent tricycle and
        motorcycle drivers in Dumaguete City, Bacong, Sibulan and Valencia, Negros Oriental. By creating an account you agree to these Terms
        and our Privacy Policy.
      </p>

      <h2>1. Eligibility</h2>
      <ul>
        <li>Riders must be at least 18 years old, or ride with the consent and supervision of a parent or guardian.</li>
        <li>You must give accurate information, including a valid Philippine mobile number, and keep your login secure.</li>
      </ul>

      <h2>2. Fares and payments</h2>
      <ul>
        <li>Fares are shown before you book and follow the rates set by Zoomo, plus any extras, fare offer or tip you choose.</li>
        <li>Cash: you pay the driver directly at the end of the trip. Zoomo collects its commission from the driver separately.</li>
        <li>Wallet: the fare is deducted from your Zoomo wallet when the trip completes. Top-ups are processed by PayMongo via QR Ph.</li>
        <li>Wallet balances are not bank deposits, do not earn interest, and are refundable only as required by law.</li>
      </ul>

      <h2>3. Cancellations and no-shows</h2>
      <ul>
        <li>Riders may cancel before the trip starts. Requests not accepted within 2 minutes expire automatically.</li>
        <li>Repeated cancellations or no-shows may lead to account restrictions.</li>
      </ul>

      <h2>4. Driver responsibilities</h2>
      <ul>
        <li>Hold a valid LTO driver's license for the vehicle type, and keep it current.</li>
        <li>Keep a valid OR/CR, compulsory third-party liability (CTPL) insurance, and any local franchise or permit required by the LGU.</li>
        <li>Drive safely, follow traffic laws, carry no more passengers than allowed, and provide helmets for motorcycle passengers.</li>
        <li>Settle commission owed to Zoomo; accounts over the debt limit cannot accept rides.</li>
        <li>Drivers are independent service providers, not employees of Zoomo.</li>
      </ul>

      <h2>5. Prohibited conduct</h2>
      <ul>
        <li>Harassment, discrimination, threats or violence toward any person.</li>
        <li>Driving or riding under the influence of alcohol or drugs.</li>
        <li>Fraud, fake accounts, fare manipulation or misuse of promo codes.</li>
        <li>Carrying illegal items, or using Zoomo for any unlawful purpose.</li>
        <li>Misusing the SOS feature.</li>
      </ul>

      <h2>6. Safety</h2>
      <p>
        The SOS button alerts Zoomo and gives quick access to 911 and the Philippine Red Cross (143). Zoomo is not an emergency service —
        always contact authorities first when in danger.
      </p>

      <h2>7. Limitation of liability</h2>
      <p>
        To the extent allowed by Philippine law, Zoomo provides the platform "as is" and is not liable for indirect or consequential losses,
        or for the acts of riders or drivers. Nothing in these Terms limits liability that cannot be limited by law, including rights under the
        Consumer Act of the Philippines (RA 7394).
      </p>

      <h2>8. Suspension and termination</h2>
      <p>We may suspend accounts that breach these Terms. You may delete your account at any time from the Account page.</p>

      <h2>9. Disputes</h2>
      <p>
        Report problems through "Report a problem" on your trip. We aim to respond within 5 business days. Unresolved disputes are governed by
        Philippine law and fall under the courts of Dumaguete City, without prejudice to your right to go to the DTI or other agencies.
      </p>

      <h2>10. Contact</h2>
      <p>
        <a className="text-accent" href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a> (placeholder — replace before launch).
      </p>
    </LegalLayout>
  );
}
