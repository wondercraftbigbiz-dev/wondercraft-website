import 'server-only'

import Stripe from 'stripe'

/**
 * The Stripe client. Server-only: `STRIPE_SECRET_KEY` must never reach the
 * browser, so this module starts with `import 'server-only'` and importing it
 * from a client component is a build error rather than a leaked key.
 *
 * Note there is deliberately no publishable-key export here. Checkout is a
 * redirect to Stripe's own page, so the browser never talks to Stripe directly
 * and needs no key at all.
 */
function requireKey(): string {
  const key = (process.env.STRIPE_SECRET_KEY ?? '').trim()
  if (!key) {
    // Fail here, with a name, rather than at the API call with a 401 that
    // reads like Stripe rejecting us. Mirrors lib/econt/config.ts.
    throw new Error(
      'STRIPE_SECRET_KEY is not set. Card payment cannot be started without it.',
    )
  }
  return key
}

let client: Stripe | null = null

export function getStripe(): Stripe {
  if (!client) {
    client = new Stripe(requireKey(), {
      // Pinned on purpose: an account-level API upgrade must not silently
      // change the shape of the webhook payloads this app parses.
      apiVersion: '2026-08-26.dahlia',
      appInfo: { name: 'Wondercraft', url: 'https://wondercraft.bg' },
    })
  }
  return client
}

/** True when card payment is configured at all. */
export function isStripeConfigured(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? '').trim() !== ''
}
