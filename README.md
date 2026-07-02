# Rinse

An Uber-style home laundry marketplace for South Africa. Three mobile apps share one Supabase backend:

- `apps/customer` — schedule pickups, pay, track orders live, rate partner/driver/service
- `apps/partner` — set availability, accept/decline orders, mark jobs done, cash out
- `apps/driver` — go online, accept nearest-first job offers, confirm pickup/delivery with photos, cash out
- `packages/shared` — Supabase client, auth (phone OTP), DB types, theme tokens, shared UI
- `supabase/` — schema migrations, seed data, and the PayFast edge functions

## Get started

1. Install dependencies (run once, from the repo root):

   ```bash
   npm install
   ```

2. Start Supabase locally (requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)):

   ```bash
   cd supabase
   supabase start
   ```

   This applies `migrations/` and `seed.sql` automatically. Copy the printed **API URL** and **anon key** into each app's `.env` (copy from `.env.example`).

3. Run an app:

   ```bash
   npm run customer   # or: npm run partner / npm run driver
   ```

   Then press `i` (iOS), `a` (Android), or `w` (web) in the Expo CLI.

### Test accounts (local dev only)

`supabase/config.toml` defines fixed test OTP codes so you don't need a real SMS provider locally — enter one of these numbers and the code `123456`:

| Number | Suggested role |
| --- | --- |
| 0710000001 | Customer |
| 0710000002 | Partner |
| 0710000003 | Driver |

## Payments (PayFast)

`supabase/functions/payfast-checkout` builds a signed PayFast redirect; `payfast-webhook` verifies PayFast's ITN and marks orders paid. Both need secrets set before they'll work — copy `supabase/.env.example` to `supabase/.env` for local testing with PayFast's public sandbox credentials (already filled in), or `supabase secrets set` for a deployed project.

## What's stubbed

This is a working skeleton, not a finished product. Known simplifications to revisit:

- **Partner matching** (`apps/customer/src/app/booking/matching.tsx`) picks the best-rated approved partner directly — no real nearest-first distance ranking or timed accept/decline yet (the `dispatch_offers` table already supports it).
- **Driver dispatch** isn't triggered automatically when a partner accepts an order or marks it done — there's a `TODO` at each hook point in the partner Home screen and this would be a Postgres function or edge function reacting to order status changes.
- **Driver earnings** use a flat placeholder rate per completed leg (`RATE_PER_TRIP` in `apps/driver/src/app/(tabs)/earnings.tsx`) — no real per-km payout schedule yet.
- **Admin dashboard** (approving partners/drivers, managing service tiers) is out of scope per the original spec — currently you'd approve accounts by flipping `status` to `'approved'` directly in the database.
