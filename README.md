# wondercraft-website

This is a [Next.js](https://nextjs.org) project bootstrapped with [v0](https://v0.app).

## Built with v0

This repository is linked to a [v0](https://v0.app) project. You can continue developing by visiting the link below -- start new chats to make changes, and v0 will push commits directly to this repo. Every merge to `main` will automatically deploy.

[Continue working on v0 →](https://v0.app/chat/projects/prj_55CiNmcS7zjazCHSAoXE4KB0Tifk)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Environment

Copy `.env.example` to `.env.local` and fill in what you need:

```bash
cp .env.example .env.local
```

Out of the box `ECONT_MODE=fixture`, so the delivery picker works with no
network access and no credentials — it serves canned cities, offices and prices
from `lib/econt/fixtures/`. That is the default for a reason (see below).

**No Econt variable may ever be prefixed `NEXT_PUBLIC_`.** That would inline the
API password into the browser bundle. Every module that reads these values lives
under `lib/econt/` and begins with `import 'server-only'`, so an accidental
client import fails the build instead of leaking. Before deploying, confirm:

```bash
pnpm build && grep -r "iasp-dev\|1Asp-dev\|ECONT_PASSWORD" .next/static ; echo "exit=$? (1 = clean)"
```

### Econt integration

Delivery uses the [e-Econt JSON API](https://ee.econt.com/services/) directly —
`POST <base>/<Service>/<Service>.<method>.json` with HTTP Basic auth. We build
our own city/office pickers rather than embedding Econt's hosted iframe, so the
checkout matches the site's design.

- Test: `https://demo.econt.com/ee/services`, credentials `iasp-dev` / `1Asp-dev`
- Production: `https://ee.econt.com/services`, credentials from the Econt contract
- Register for a test account at <https://login-demo.econt.com/register/>

The base URL and the credentials are a matched pair — the two environments are
separate Econt accounts, so contract credentials fail against demo and vice
versa. `ECONT_BASE_URL` is therefore **required** when `ECONT_MODE=live`, with no
default: a live deploy missing it would otherwise quote demo tariffs as if they
were the contract's, silently.

Nothing here creates a shipment. `calculateShipping()` is the only call that
posts to `Shipments/`, always with `mode: 'calculate'`; `mode: 'create'` exists in
the type union and at no call site. Live credentials price parcels, they do not
spend money.

**Some sandboxed environments block `*.econt.com`.** Claude Code's web sandbox,
for instance, returns `403` to the proxy `CONNECT`:

```bash
curl -sS "$HTTPS_PROXY/__agentproxy/status"   # shows the rejection
curl -v https://demo.econt.com/               # CONNECT tunnel failed, 403
```

That is a network policy, not a bug — do not "fix" it by disabling TLS
verification or unsetting `HTTPS_PROXY`. Use `ECONT_MODE=fixture` locally and
verify against the real API on a Vercel **preview** deployment with the demo
credentials in the Preview environment scope. Never point production at demo.

`ECONT_FIXTURE_FAULT` forces each failure mode (`timeout`, `auth`, `validation`,
`upstream`, `empty`) so every error state in the UI is reachable offline.

#### Before this can go live

`PACKED_PARCEL` in `lib/data/pricing.ts` now carries the real packed box —
5 kg, 90 × 60 × 20 cm — so the delivery quote is live and the checkout prices
shipping instead of showing "по договаряне". Re-measure and correct it if the
packing changes: Econt prices on weight **and** volumetric weight, and a number
that is too low is absorbed by the shop on every order.

One consequence is deliberate. That box does not fit an Econt automat (the
locker limit is 60 × 40 × 40, `lib/econt/constraints.ts`), so `canFitInAps()` is
false and the checkout greys the "Автомат" option out on its own. Nothing to
configure — but if the box ever shrinks, the option comes back by itself.

Still unconfirmed: which field of Econt's `createLabel` response is the amount to
charge. `resolvePrice()` in `lib/econt/shipping.ts` prefers
`courierServicePrice`, then `totalPrice`, and deliberately never
`receiverDueAmount` (which folds in cash-on-delivery). Confirm against the real
API on a preview deploy before launch — this is now the amount a customer's card
is charged, not a number on a screen.

### Payments (Stripe)

Card payment via **hosted Stripe Checkout**: the browser posts the order to
`/api/order`, the server re-prices it, creates a Checkout Session and returns its
URL, and the customer is redirected to a page Stripe owns. No card data ever
touches this site, so there is no publishable key and no browser Stripe SDK
anywhere in the bundle.

The order round trip, and why it is in this order:

1. `submitOrder()` prices the plan from `lib/data/pricing.ts` and the delivery
   from a fresh Econt quote. **The browser never sends an amount.**
2. **No delivery price, no payment.** If Econt cannot quote, there is no total
   worth charging: the order is saved `unpaid` and the shop's existing phone
   flow takes over. It is never sent to Stripe short of the shipping cost.
3. Otherwise the Checkout Session is created **first**, because its id is what
   the order row is keyed on — `mark_order_paid()` finds the order by
   `provider_order_id`, so a row without one could never settle.
4. `place_order()` writes the order as `pending` with that session id.
5. The customer pays, and Stripe posts to `/api/stripe/webhook`. The signature
   is verified against the raw body, then `mark_order_paid()` settles the row —
   after re-checking the notified amount against the `total_eur` the server
   computed. A disagreement sets `payment_mismatch` instead of marking it paid.
6. `/order/success` reports what the webhook recorded. It never marks anything
   paid itself: it is a redirect URL anyone could type.

**A double submit cannot produce two orders.** The browser mints one `attemptId`
(a v4 UUID) per checkout; it is the Stripe idempotency key *and*
`orders.attempt_id`, which is uniquely indexed, so a retry re-finds the first
order rather than creating a second.

The database was built for this and needs no migration: `place_order()` and
`mark_order_paid()` are `security definer`, granted to `service_role` alone, and
are the only writes this app makes. `lib/db/client.ts` is the whole data layer.

Setup outside the code:

- Stripe → Developers → Webhooks → add `https://<domain>/api/stripe/webhook`
  for `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
  **Do this in test mode and live mode separately** — the signing secrets differ,
  and the wrong one rejects every notification, stranding paid orders as `pending`.
- Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SITE_URL` in Vercel, with test
  keys scoped to Preview and live keys to Production.
- Confirm payouts are enabled on the Stripe account, or money is captured and
  never paid out.

`STRIPE_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` follow the same rule as the
Econt credentials: **never `NEXT_PUBLIC_`**, and every module that reads them
starts with `import 'server-only'`. The bundle check extends accordingly:

```bash
pnpm build && grep -r "sk_live\|sk_test\|whsec_\|SERVICE_ROLE" .next/static ; echo "exit=$? (1 = clean)"
```

#### Layout

| Path | What lives there |
|---|---|
| `lib/econt/client.ts` | HTTP, Basic auth, timeouts, error mapping |
| `lib/econt/nomenclatures.ts` | cities, offices, streets, quarters → client-safe DTOs |
| `lib/econt/shipping.ts` | the delivery quote (`createLabel` `mode: 'calculate'`) |
| `lib/econt/dto.ts` | the only Econt types the browser sees |
| `lib/econt/fixtures/` | offline data, including the awkward cases |
| `lib/order/schema.ts` | validation both the browser and the API run |
| `lib/order/submit-order.ts` | where an order becomes real — pricing, the DB write, the Stripe session |
| `lib/order/create-checkout.ts` | the hosted Checkout Session |
| `lib/db/client.ts` | the only database access: two RPCs and two narrow reads |
| `lib/stripe/client.ts` | the Stripe SDK, the pinned API version, the site origin |
| `app/api/stripe/webhook` | the one place an order is marked paid |
| `app/api/econt/*`, `app/api/order` | the routes |
| `components/site/checkout/` | the form UI, driven by `order-reducer.ts` |

Two boundaries worth not eroding:

- **Quote requests carry a plan id, never a weight or a price.** The server reads
  those from `lib/data/pricing.ts`. A client that could send them could quote
  itself free shipping, and once Stripe is wired up, underpay.
- **Nothing under `lib/econt/` except `dto.ts` may be imported by a client
  component.** The rest starts with `import 'server-only'`, so a mistake is a
  build error rather than a leaked password.

Orders are written to Supabase. The logs carry one `order.placed` line with the
shape and the money and **no personal data** — names, phones and addresses live
in the database, where they have a retention policy, rather than in application
logs, where they would not.

### Checks

```bash
pnpm typecheck     # required: next.config.mjs sets ignoreBuildErrors, so `build` proves nothing about types
pnpm check:money   # price/currency formatting and BGN↔EUR conversion
pnpm check:econt   # Econt client, DTO mapping and every fault mode, in fixture mode
```

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.
