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
- Ride money/status logic lives in Postgres security-definer RPCs (`accept_ride`, `complete_ride`, `rider_cancel_ride`, `driver_set_ride_status`); `protect_ride_update` blocks other direct changes — tamper-proof trips.
- Roles live in `user_roles`, checked via `has_role()` — prevents privilege escalation.
- Maps go through `src/components/Map.tsx` (client-only) — Leaflet breaks SSR.
- Wallet credited only by the signed PayMongo webhook via `credit_paid_checkout` — never the client.
- Cash trips debit commission from driver wallet (capped by `max_driver_debt`); payouts reserve via `request_payout` — wallet is the single ledger.
- Nav mode and role homes come from `src/lib/nav.ts` — one source of truth.
- No AI in booking (user removed it).
- Direct requests: `rides.target_*` set server-side, hidden by RLS from other drivers, changed only via `ride_retarget`/`ride_broadcast`/`decline_direct_ride`.
- Cross-user discovery only via `drivers_for_pickup`/`nearby_ride_requests` (rounded coords, no contacts) — privacy.
- Rider cancel refused when driver ≤1 km from pickup (`rider_cancel_blocked`).
- Public reference documents use leaf routes with their own metadata and browser printing rather than generated PDF storage — keeps sharing and printing accessible without a document service.
