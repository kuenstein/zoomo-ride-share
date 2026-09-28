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
