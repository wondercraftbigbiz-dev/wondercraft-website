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
   There is no `STRIPE_MODE`: the keys are the switch.
   **Rebuild afterwards, not just redeploy** — the publishable key is inlined
   into the browser bundle at build time.
3. Register the live webhook endpoint at `https://<domain>/api/stripe/webhook`.
4. Fill in `PACKED_PARCEL` in `lib/data/pricing.ts` and `DISPATCH` in
   `lib/data/dispatch.ts`, clearing both placeholder flags. Until then
   `assertChargeable()` refuses every live card.
5. Confirm `resolvePrice()`'s field choice against the real Econt API, per the
   README's "Before this can go live" section.
6. Check `GET /api/health` on the deployment returns 200, and run the extended
   secret-leak grep in the README.

Delete this section only when live payments are confirmed working in production.

## Other open blockers

- **`PACKED_PARCEL` in `lib/data/pricing.ts` is still zeroed.** The owner will
  measure a real packed box later. Until then `isParcelConfigured()` is false,
  `calculateShipping()` throws, and every delivery quote fails closed.

  **Placeholder values are currently in place**, so the quote no longer fails
  closed — it fails OPEN, quoting confidently from a guessed box.
  `assertChargeable()` in `lib/payments/readiness.ts` is what stops that
  reaching real money: with `sk_live_` keys it refuses while
  `PARCEL_IS_PLACEHOLDER` or `DISPATCH_IS_PLACEHOLDER` is set. Do not work
  around the measurement with an env override: `lib/data/pricing.ts` is reachable from client components, so
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
