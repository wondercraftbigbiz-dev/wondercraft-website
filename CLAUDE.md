# wondercraft-website — working notes for Claude

Read `README.md` first. It is accurate and unusually detailed. This file only
carries things that are not in it.

## ⚠️ STRIPE IS IN TEST MODE — LIVE KEYS ARE STILL OUTSTANDING

The Stripe integration is built and configured with **test** credentials only
(`pk_test_…`, `sk_test_…`, and a test-mode `whsec_…`). The owner has not yet
completed Stripe account setup, so **no live keys exist yet**.

**Standing instruction from the owner:**

> Whatever we are working on — any feature, any fix, any improvement, however
> unrelated to payments — remind me that Stripe still needs to be set up for
> live production.

So: **end every working session on this repo with that reminder**, until this
section is deleted. It is not conditional on the task touching payments.

### What "going live" will require

1. Complete Stripe account activation (business details, bank account).
2. Swap all three secrets for live values in the Vercel **Production** scope:
   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_live_…`),
   `STRIPE_SECRET_KEY` (`sk_live_…`),
   `STRIPE_WEBHOOK_SECRET` (a **third, different** `whsec_…` from the live-mode
   Dashboard endpoint — test and live signing secrets are never interchangeable).
3. Set `STRIPE_MODE=live` in Production.
4. Register the live webhook endpoint at `https://<domain>/api/stripe/webhook`.
5. Fill in `PACKED_PARCEL` in `lib/data/pricing.ts` (see below). Checkout is
   structurally unreachable until this is done, and with no cash-on-delivery
   fallback that means no orders at all.
6. Confirm `resolvePrice()`'s field choice against the real Econt API, per the
   README's "Before this can go live" section.
7. Run the extended secret-leak grep in the README.

Delete this section only when live payments are confirmed working in production.

## Other open blockers

- **`PACKED_PARCEL` in `lib/data/pricing.ts` is still zeroed.** The owner will
  measure a real packed box later. Until then `isParcelConfigured()` is false,
  `calculateShipping()` throws, and every delivery quote fails closed.

  **Card is the only payment method, so this blocks EVERY order.** No quote means
  no total, which means nothing to charge and no way to complete checkout. The
  shop cannot take a single order until the box is measured. Do not work around
  it with an env override: `lib/data/pricing.ts` is reachable from client components, so
  a non-`NEXT_PUBLIC_` read there is `undefined` in the browser and set on the
  server, which is silent client/server divergence in the one module that must
  not diverge.

## Secrets hygiene

- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS on the `orders` table, which holds
  customer names, phones and addresses. Server-only, never `NEXT_PUBLIC_`.
- There is deliberately **no** `NEXT_PUBLIC_SUPABASE_ANON_KEY` in this project.
  Its absence is a design feature: no variable means no accidental client path
  to the orders table. Do not add one.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is the one intentional exception to the
  "no NEXT_PUBLIC_ secrets" rule in `.env.example`. Publishable keys are meant to
  be public; `loadStripe()` needs it in the browser. Do not "fix" it.

## Checks

`pnpm typecheck` is the real gate — `next.config.mjs` sets
`ignoreBuildErrors: true`, so `pnpm build` proves nothing about types.
Also: `pnpm check:money`, `pnpm check:order`, `pnpm check:econt`, `pnpm check:payment`.
