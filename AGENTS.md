<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Zoomo architecture rules
- Ride money logic (accept, complete, promo, wallet) lives in Postgres security-definer functions called via RPC — clients must never compute or write fares.
- Roles live in `user_roles` and are checked with `has_role()`; never store roles on `profiles`.
- Map rendering goes through `src/components/Map.tsx` (client-only lazy wrapper) — never import Leaflet in an SSR path.
- Wallet top-ups go through PayMongo checkout (`src/lib/payments.functions.ts`); the wallet is credited only by the signature-verified webhook `/api/public/paymongo-webhook` via `credit_paid_checkout` (service role) — never from the client.
- AI Gateway calls live in `src/lib/ai-gateway.server.ts` (streamed Responses, `system` option for instructions) — keeps the key server-side.
- Navigation mode (rider/driver bottom nav) is derived from the page path, falling back to the last mode saved in `src/lib/nav.ts`; role-based home screens come from `homeForRoles()` there — one source of truth for post-login and 404 redirects.
- Privacy RLS regression tests live in `supabase/tests/rls_privacy_policies.sql` (self-contained, rolls back) — rerun after any policy change on profiles/drivers/vehicles/driver_locations/pricing.
- Ride status changes by riders/drivers go through `rider_cancel_ride` / `driver_set_ride_status` / `accept_ride` / `complete_ride`; the `protect_ride_update` trigger blocks any other direct change — keeps trips and money tamper-proof.
- Cash trips debit Zoomo's commission from the driver wallet (may go negative, capped by `pricing_settings.max_driver_debt`); payouts reserve funds via `request_payout` — wallet stays the single ledger.
- Ride/money regression tests live in `supabase/tests/ride_money_protections.sql` (rolls back) — rerun after changing ride, wallet or signup functions.
