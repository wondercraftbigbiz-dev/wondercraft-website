import 'server-only'

import Stripe from 'stripe'
import { getStripeConfig } from './config'
import { PaymentError } from './errors'

let client: Stripe | null = null

/**
 * The single Stripe client.
 *
 * `apiVersion` is deliberately left unset. stripe-node pins the version it was
 * generated against and sends it on every request, so omitting it keeps the SDK
 * and the wire format in lockstep across upgrades. Pinning a literal here would
 * type-error on every SDK bump (the type is the single latest version), which
 * reads like diligence but only ever produces churn.
 */
export function getStripe(): Stripe {
  const config = getStripeConfig()
  if (config.mode !== 'live') {
    throw new PaymentError('disabled', 'Stripe is disabled (STRIPE_MODE)')
  }

  client ??= new Stripe(config.secretKey, {
    typescript: true,
    // Stripe's own advice: retry idempotently rather than surfacing a blip. Our
    // create call carries an idempotency key, so a retry cannot double-charge.
    maxNetworkRetries: 2,
    timeout: 20_000,
  })

  return client
}
