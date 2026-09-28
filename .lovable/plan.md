# Launch-readiness batch (Dumaguete)

This batch is large, so it ships in 6 stages, in this order. Each stage is built, checked, and tested before the next one starts.

## Stage 1 - Legal pages and consent
- Public /terms and /privacy pages for Zoomo in Dumaguete, Bacong, Sibulan and Valencia. They cover the Data Privacy Act and PayMongo, carry a "Template - have a lawyer review before launch" banner, and use a placeholder contact email.
- Required consent checkbox on rider and driver signup. `profiles.consent_at` and `profiles.consent_version` are saved when the user agrees, and the current version lives in one constant.
- Users who signed up before this change see a one-time consent dialog after login.
- Footer and Account link to both pages.
- A "Delete my account and data" button with confirmation. It anonymizes the profile, deletes saved places, messages, trusted contacts, push subscriptions and documents, and keeps rides and payments for accounting under an anonymized identity. It then deletes the login.

## Stage 2 - Driver documents
- Private `driver-documents` storage bucket (images or PDF, 5 MB max). Drivers can only reach their own folder, admins can read all files, and files open only through signed links that expire after 5 minutes.
- New `driver_documents` table with four document types: license, OR/CR, vehicle, selfie. Each has a status and a reviewer note.
- New `drivers.license_expiry` date.
- Onboarding can't be submitted until all 4 documents are uploaded. The pending screen shows which documents are missing or rejected, with the admin's note, and allows re-upload.
- Admin Drivers tab: preview each document, approve or reject it with a reason, and see the driver's phone.
- Database rules:
  - A driver can only be approved when all 4 documents are approved.
  - A driver can't go online or accept rides with an expired license.
- Signup requires a valid PH mobile number (this check already exists; it gets confirmed).

## Stage 3 - Safety
- New tables:
  - `safety_incidents`: readable by the reporter and admins
  - `reports`: the reporter reads their own, admins read and update all
  - `trusted_contacts`: private to the owner
- SOS button on active trips for both rider and driver, with a confirm step. It opens a screen with tap-to-call 911 and 143, plus a share-sheet message with driver name, plate, vehicle, current location and trusted contact names.
- "Report a problem" button on completed trips.
- Admin gets a Safety tab (updates live, open incidents on top, contact info for both parties, acknowledge/notes/resolve) and a Reports tab. The admin menu shows a red badge with the count of open incidents.

## Stage 4 - Alerts and push
- Online drivers get a sound, vibration and a flashing tab title for new requests. The screen stays awake while the driver is online.
- New `push_subscriptions` table, private to the owner. Web Push is sent from the server using VAPID keys.
- Pushes are sent for: new request (to matching nearby drivers), driver accepted, driver arrived, trip completed, payout status, and driver approval. They go through one `notify()` helper with a push channel and an empty SMS placeholder for a provider later.
- Installable app with an offline fallback page. The service worker never registers inside the editor preview.
- Account settings: turn notifications and sounds on or off, with help for blocked permissions and the iPhone "Add to Home Screen" requirement.

## Stage 5 - Maps behind the server
- New `src/lib/geo.functions.ts` server functions for address search and routing, backed by swappable adapters.
- Settings:
  - `GEOCODER_PROVIDER` = nominatim | geoapify | maptiler | mapbox
  - `ROUTING_PROVIDER` = osrm | openrouteservice | mapbox | geoapify
  - Keys: `GEOAPIFY_API_KEY`, `MAPTILER_API_KEY`, `MAPBOX_TOKEN`, `ORS_API_KEY`
  - `MAPS_CONTACT_EMAIL` (sent to map providers as the contact address)
- A database cache table (`geo_cache`) and a per-user limit of 30 requests per minute. Search waits 350 ms after typing and needs at least 3 characters.
- If routing fails, the app falls back to straight-line distance and shows an "approximate route" note next to the fare. The map keeps the OpenStreetMap credit.

## Stage 6 - Launch checklist (admin)
- A server function checks whether each required secret is present (values are never shown) and reads live data. It shows pass or fail with fix instructions for:
  - PayMongo keys
  - last paid QR Ph top-up
  - approved driver
  - active service area
  - pricing changed from defaults
  - admin count
  - expiry job
  - VAPID keys
  - consent version
  - maps provider

## Scheduled expiry
Stage 6 can only pass this check if a real schedule exists. I'll add a protected `/api/public/cron/expire-rides` endpoint and try to enable scheduled database jobs. If that isn't possible here, the checklist item stays "fail" with instructions.

## Finish
- Rerun both existing SQL test suites and add a new `supabase/tests/launch_rls.sql` for documents, incidents, reports, trusted contacts and push subscriptions.
- List what changed, manual steps, and any remaining security warnings.

## Secrets you will need to add
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (for example mailto:you@domain). I can generate the key pair for you.
- A maps key later (optional).

## Other manual steps
- PayMongo live activation and enabling QR Ph
- Lawyer review of the legal pages
- Custom domain
