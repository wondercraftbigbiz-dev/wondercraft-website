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

`PACKED_PARCEL` in `lib/data/pricing.ts` is still zeroed, with a TODO. Econt
prices on weight **and** volumetric weight, so until a real packed box is
measured the delivery quote fails closed on purpose: the checkout shows
"по договаряне" and the total is the product price alone. It never invents a
number, because a number that is too low is absorbed by the shop on every
order. Filling in that one block turns the live price on.

Also unconfirmed: which field of Econt's `createLabel` response is the amount to
charge. `resolvePrice()` in `lib/econt/shipping.ts` prefers
`courierServicePrice`, then `totalPrice`, and deliberately never
`receiverDueAmount` (which folds in cash-on-delivery). Confirm against the real
API on a preview deploy before launch.

#### Layout

| Path | What lives there |
|---|---|
| `lib/econt/client.ts` | HTTP, Basic auth, timeouts, error mapping |
| `lib/econt/nomenclatures.ts` | cities, offices, streets, quarters → client-safe DTOs |
| `lib/econt/shipping.ts` | the delivery quote (`createLabel` `mode: 'calculate'`) |
| `lib/econt/dto.ts` | the only Econt types the browser sees |
| `lib/econt/fixtures/` | offline data, including the awkward cases |
| `lib/order/schema.ts` | validation both the browser and the API run |
| `lib/order/submit-order.ts` | where an order becomes real — the DB/Stripe seam |
| `app/api/econt/*`, `app/api/order` | the routes |
| `components/site/checkout/` | the form UI, driven by `order-reducer.ts` |

Two boundaries worth not eroding:

- **Quote requests carry a plan id, never a weight or a price.** The server reads
  those from `lib/data/pricing.ts`. A client that could send them could quote
  itself free shipping, and once Stripe is wired up, underpay.
- **Nothing under `lib/econt/` except `dto.ts` may be imported by a client
  component.** The rest starts with `import 'server-only'`, so a mistake is a
  build error rather than a leaked password.

Orders are currently written to the logs only — `order.received` for the shape
and money, `order.contact` for personal data, split so the second can be dropped
or routed separately. Both are replaced by the database write in the next phase.

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
