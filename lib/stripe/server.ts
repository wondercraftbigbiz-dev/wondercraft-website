import 'server-only'

import Stripe from 'stripe'

/**
 * Server-side Stripe client. Never import from a client component — the
 * secret key it reads must not reach the browser bundle.
 */
let client: Stripe | undefined

export function getStripe(): Stripe {
  if (client) return client

  const secretKey = (process.env.STRIPE_SECRET_KEY ?? '').trim()
  if (!secretKey) {
    throw new Error('Stripe is misconfigured: missing STRIPE_SECRET_KEY')
  }

  client = new Stripe(secretKey)
  return client
}
