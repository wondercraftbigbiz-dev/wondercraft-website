import { loadStripe, type Stripe } from '@stripe/stripe-js'

/**
 * Client-side Stripe.js loader. The publishable key is safe to expose — it
 * has no privileges beyond starting a payment the server already priced.
 */
let promise: Promise<Stripe | null> | undefined

export function getStripeClient(): Promise<Stripe | null> {
  if (!promise) {
    const key = (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '').trim()
    if (!key) {
      throw new Error('Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')
    }
    promise = loadStripe(key)
  }
  return promise
}
