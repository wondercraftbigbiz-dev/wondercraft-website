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
pnpm build
grep -rqE "sk_live_|sk_test_|rk_live_|whsec_|service_role|iasp-dev|1Asp-dev|ECONT_PASSWORD" .next/static \
  && echo "LEAK" || echo "clean"
```

`pk_test_`/`pk_live_` are deliberately **not** in that pattern: a publishable key
belongs in the bundle. Including it would make the check fail every time, and a
check that always fails gets ignored and then deleted.

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

`PACKED_PARCEL` in `lib/data/pricing.ts` is still zeroed, with a TODO. Econt
prices on weight **and** volumetric weight, so until a real packed box is
measured the delivery quote fails closed on purpose. It never invents a number,
because a number that is too low is absorbed by the shop on every order.

**Since card is the only payment method, this now blocks every order, not just
card ones.** No quote means no total, which means nothing to charge, so the
checkout cannot complete at all. Filling in that one block is what opens the shop.

Also unconfirmed: which field of Econt's `createLabel` response is the amount to
charge. `resolvePrice()` in `lib/econt/shipping.ts` prefers
`courierServicePrice`, then `totalPrice`, and deliberately never
`receiverDueAmount` (which folds in cash-on-delivery). Confirm against the real
API on a preview deploy before launch.


### Payments

**Card is the only payment method.** There is no cash on delivery and no offline
fallback: every order is paid by card, through Stripe, in the order modal.

That makes the checkout fail closed in three places, all deliberate:

- **No Econt quote, no order.** With no delivery price there is no total, and a
  card cannot be charged an amount nobody computed. While `PACKED_PARCEL` is
  unmeasured the quote always fails, so **no order can be placed at all** — see
  "Before this can go live".
- **No database row, no charge.** `createIntent()` refuses if the order cannot be
  recorded first. Money with no record of what it was for is the one failure that
  cannot be cleaned up afterwards.
- **Econt down means sales stop.** Previously cash on delivery absorbed an Econt
  outage. Nothing absorbs it now. This is the accepted cost of a single payment
  path; if it starts to hurt, the fix is a fallback flow, not a guessed price.

#### Order of operations, and why

```
price  ->  compare  ->  INSERT row  ->  create PaymentIntent  ->  attach id
```

The row is written **before** Stripe is called. The unrecoverable failure is a
charge with no order behind it, and this inverts it, so the worst case is an
unpaid orphan row that nobody was charged for.

It also makes both races harmless. Stripe's webhook routinely arrives before the
browser's `confirmPayment()` resolves, and customers close the tab after paying.
In both cases the row already exists and the webhook is a guarded `UPDATE`.

`attempt_id` covers the gap between the insert and the intent existing, and is
what makes a duplicate submit find the existing row instead of opening a second
order. The Stripe idempotency key is derived from it, **not** from the order
reference: a reference is issued per call, so a reference-keyed request would be
unique every time and protect nothing.

#### The webhook is the only thing that marks an order paid

`app/api/stripe/webhook/route.ts` verifies the signature against the raw request
body (`await request.text()` — parsing and re-serializing changes the bytes and
the HMAC fails), then calls `mark_order_paid()`. That function does the work that
matters, in the database, under a row lock: it refuses to settle twice, and it
re-checks the amount against the total this server computed at checkout. A
notification reporting the wrong amount flags the row rather than being believed.

The browser's `confirmPayment()` result drives what the customer sees and nothing
else. A client cannot be trusted to declare itself paid, and is not even present
for the cases that matter most.

The webhook is deliberately **not** rate limited: Stripe retries in bursts from a
small address range, and a dropped event is a paid order that never gets marked
paid.

#### Local webhooks

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook   # prints a whsec_
```

That `whsec_` is not the same value as the Dashboard endpoint's, and live mode
has a third. See `.env.example`.

Test cards (any future expiry, any CVC):

| Card | Behaviour |
|---|---|
| `4242 4242 4242 4242` | succeeds |
| **`4000 0025 0000 3155`** | **3DS challenge every time — the PSD2 path, test this first** |
| `4000 0084 0000 1629` | authenticates, then declines |
| `4000 0000 0000 0002` | generic decline |
| `4000 0000 0000 9995` | insufficient funds |

Under PSD2, a 3DS challenge is the normal path in the EU, not an edge case.

**Deployment Protection blocks the webhook on Vercel deploys.** The project has
Vercel Authentication on with scope `all_except_custom_domains` and no custom
domain, so every `*.vercel.app` URL returns an SSO login page and Stripe records
every delivery as failed. Turn it off, or add a custom domain, before registering
an endpoint.

**`api.stripe.com` is blocked in Claude Code's web sandbox**, exactly as
`*.econt.com` is, and for the same reason. Verify the card path on a deploy.

#### Configuration, and why so little of it is in the environment

Two things make environment variables a poor place for configuration here:

- **Vercel snapshots them into a deployment.** Editing one in the dashboard
  updates the project, not deployments already built.
- **`NEXT_PUBLIC_` ones are inlined into the JS bundle at build time.** Setting
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` after a build leaves the shipped bundle
  with `undefined`. That needs a rebuild, not a redeploy.

Neither is fixable, so the answer is fewer of them. Only genuine secrets remain:
Econt's credentials and base URL, the three Stripe keys, and the Supabase URL and
service-role key. Everything else — the parcel, the dispatch point, the automat
limits — lives in `lib/data/`, where a missing field is a typecheck failure
rather than something a customer discovers mid-order.

**`GET /api/health`** answers "can this deployment take an order?" It returns the
names of what is missing and the consequence of each, never values, and 503 until
there is nothing left. `pnpm check:ready` is the local equivalent.

#### The live-money guard

`assertChargeable()` runs at the top of `createIntent()`. With `sk_live_` keys it
refuses to charge when:

- Econt is not in live mode — the fixture client invents prices
  (`5.90 + weight x 0.60` BGN) and returns them as authoritative;
- `PARCEL_IS_PLACEHOLDER` is set — delivery priced from a guessed box;
- `DISPATCH_IS_PLACEHOLDER` is set — parcels have no real origin.

With test keys it does nothing, so the flow stays clickable before the real
numbers are known. Both placeholder flags existed for a commit as comments
nothing read; this is what makes them load-bearing.

#### PCI scope

Card details are entered into Stripe's cross-origin iframe and never touch this
origin, which keeps the integration in SAQ-A. Nothing in the modal may ever read,
log or forward a card number.

#### Layout

| Path | What lives there |
|---|---|
| `lib/econt/client.ts` | HTTP, Basic auth, timeouts, error mapping |
| `lib/econt/nomenclatures.ts` | cities, offices, streets, quarters → client-safe DTOs |
| `lib/econt/shipping.ts` | the delivery quote (`createLabel` `mode: 'calculate'`) |
| `lib/econt/dto.ts` | the only Econt types the browser sees |
| `lib/econt/fixtures/` | offline data, including the awkward cases |
| `lib/order/schema.ts` | validation both the browser and the API run |
| `lib/order/pricing.ts` | authoritative pricing, shared by the quote and the charge |
| `lib/data/dispatch.ts` | where parcels ship FROM — in code, not the environment |
| `lib/payments/readiness.ts` | what is missing, and the live-money guard |
| `supabase/migrations/` | the database schema, source of truth |
| `app/api/health` | whether a running deployment can take an order |
| `lib/order/repository.ts` | the only module that talks to the orders database |
| `lib/payments/` | Stripe config, client, intent creation, webhook parsing |
| `lib/payments/dto.ts` | the only payments types the browser sees |
| `lib/supabase/admin.ts` | the service-role client, server-only |
| `app/api/payment/intent`, `app/api/stripe/webhook` | the card routes |
| `components/site/checkout/payment-step.tsx` | the Payment Element |
| `app/api/econt/*` | the delivery routes |
| `components/site/checkout/` | the form UI, driven by `order-reducer.ts` |

Two boundaries worth not eroding:

- **Quote requests carry a plan id, never a weight or a price.** The server reads
  those from `lib/data/pricing.ts`. A client that could send them could quote
  itself free shipping, and once Stripe is wired up, underpay.
- **Nothing under `lib/econt/` except `dto.ts` may be imported by a client
  component.** The rest starts with `import 'server-only'`, so a mistake is a
  build error rather than a leaked password. The same holds for `lib/payments/`
  and `lib/supabase/`.
- **The PaymentIntent amount is computed server-side** from
  `findPlan().priceEurCents` plus a fresh `calculateShipping()`. The browser
  sends `expectedTotalCents` so the server can tell the customer is looking at a
  stale number, never to decide what to charge.
- **No personal data in Stripe metadata.** It is visible in the Dashboard and in
  every export. The quote id is hashed before it goes in, because for address
  delivery the quote key embeds the street and house number —
  `scripts/check-payment.ts` asserts this by searching the serialized metadata
  for the fixture's own details, which is the check that catches it.

Orders are currently written to the logs only — `order.received` for the shape
and money, `order.contact` for personal data, split so the second can be dropped
or routed separately. Both are replaced by the database write in the next phase.

### Checks

```bash
pnpm typecheck     # required: next.config.mjs sets ignoreBuildErrors, so `build` proves nothing about types
pnpm check:money   # price/currency formatting and BGN↔EUR conversion
pnpm check:econt   # Econt client, DTO mapping and every fault mode, in fixture mode
pnpm check:payment # Stripe metadata (incl. the PII denylist), amounts, webhook parsing
```

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.
