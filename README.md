# CityLink Ride

Build a fully functional ride-hailing web app (Uber/Grab-style) with a mobile-first responsive design, using a Lovable Cloud backend (auth, Postgres database, realtime, row-level security).

## Roles
Two roles: Rider and Driver (stored in a separate user_roles table, never on the profile). Users choose a role at signup and can switch to the other role later if they complete the setup for it.

## Auth
Email/password signup and login, plus Google sign-in. Profiles table with name, phone, avatar, and rating. Protected routes by role.

## Rider features
1. Home screen with an interactive map (Leaflet + OpenStreetMap tiles, no API key needed). Pickup defaults to current location via browser geolocation; the rider can drag the pin or search addresses (Nominatim geocoding) for pickup and destination.
2. Ride options: Economy, Comfort, XL, Bike. Show fare estimate, distance, ETA per option. Fare = base fare + per-km + per-minute, multiplied by a vehicle-type factor. Route and distance from OSRM public API with a straight-line fallback.
3. Request a ride: creates a ride record with status requested. Show a searching-for-driver screen with cancel option.
4. Live trip tracking: once a driver accepts, show the driver's live location on the map (realtime), driver name, photo, rating, vehicle, plate, ETA, and status steps (accepted, arriving, in progress, completed).
5. In-ride chat with the driver (realtime messages table).
6. Payment method selection (Cash, Card placeholder, Wallet). Wallet balance with top-up (simulated) and automatic deduction on trip completion.
7. After completion: fare receipt, 1–5 star rating and comment for the driver, optional tip.
8. Ride history with filters and trip detail pages. Saved places (Home, Work, custom).
9. Promo codes: apply at booking for a percent or flat discount, validated server-side.

## Driver features
1. Onboarding: vehicle type, make, model, color, plate, license number. Status starts as pending, with an admin approval flow.
2. Online/offline toggle. While online, broadcast location every few seconds to a driver_locations table (realtime).
3. Incoming ride requests appear in realtime as a popup with pickup, dropoff, distance, fare, and a 20-second accept/decline countdown. Accepting must be atomic so two drivers cannot take the same ride.
4. Trip flow buttons: Arrived at pickup, Start trip, Complete trip, plus cancel. Navigation link out to Google Maps.
5. Earnings dashboard: today, this week, total, trip count, chart of daily earnings, and a payout history list.
6. Rate the rider after each trip.

## Admin
An admin area (role admin) with: approve/reject drivers, view all rides and users, manage promo codes, adjust pricing settings (base fare, per-km, per-minute, multipliers, commission percent), and a simple stats overview (rides today, revenue, active drivers).

## Data model and security
Tables: profiles, user_roles, drivers, vehicles, rides, ride_messages, driver_locations, ratings, wallets, wallet_transactions, promo_codes, saved_places, pricing_settings, notifications. Enable RLS on every table with strict policies: riders see only their own rides and messages, drivers see only requested rides nearby or their assigned rides, admins see all. Use a security definer has_role function to avoid recursive policies. Use database functions/edge functions for accepting rides, completing trips (fare, commission, wallet transfers), and applying promos so these can't be tampered with client-side. Enable Supabase Realtime for rides, ride_messages, and driver_locations.

## Matching
When a ride is requested, notify online, approved drivers within about 5 km of the pickup, sorted by distance, using the Haversine formula in a database function. Auto-expire unaccepted requests after 2 minutes and let the rider retry.

## UX and design
Clean, modern, mobile-first design with a bottom navigation bar, a bottom-sheet booking panel over the map, smooth transitions, loading and empty states, toasts for all actions, and light/dark mode. Use a bold black and electric-green accent brand named "Zoomo". Include a landing page with hero, how-it-works, become-a-driver CTA, and footer. Add a PWA manifest so it can be installed on a phone.

Seed the database with default pricing settings, a couple of sample promo codes (WELCOME10 for 10% off, FIRST5 for a flat 5 off), and a demo admin flow. Make sure every screen and flow works end to end with real data, no placeholder screens.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9795e10e-ab5f-4098-b40f-acbf3535f7c6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
