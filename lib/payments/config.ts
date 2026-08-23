import 'server-only'

import { PaymentError } from './errors'

export type StripeConfig = {
  secretKey: string
  webhookSecret: string
  publishableKey: string
}

function env(name: string): string {
  return (process.env[name] ?? '').trim()
}

/**
 * Whether card payment is switched on.
 *
 * There is deliberately no STRIPE_MODE flag. A second switch alongside the keys
 * is one more thing to forget at launch, and forgetting it produced the worst
 * possible shape of failure: keys present, checkout apparently working, webhook
 * returning 503, and every paid order stuck at `pending` forever. Payments are
 * on when the keys are there, and off when they are not.
 */
export function isPaymentsConfigured(): boolean {
  return Boolean(env('STRIPE_SECRET_KEY') && env('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'))
}

/**
 * Read and validate configuration.
 *
 * Throws rather than returning something half-valid. Callers that must degrade
 * gracefully check isPaymentsConfigured() first.
 */
export function getStripeConfig(): StripeConfig {
  const secretKey = env('STRIPE_SECRET_KEY')
  const webhookSecret = env('STRIPE_WEBHOOK_SECRET')
  const publishableKey = env('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')

  const missing: string[] = []
  if (!secretKey) missing.push('STRIPE_SECRET_KEY')
  if (!publishableKey) missing.push('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')
  if (missing.length > 0) {
    throw new PaymentError(
      'config',
      `Stripe is misconfigured: missing ${missing.join(', ')}`,
      { detail: { missing } },
    )
  }

  // A publishable key from one account and a secret from another produces
  // intents the browser cannot confirm, with no useful error. Cheap to catch.
  if (accountOf(secretKey) !== accountOf(publishableKey)) {
    throw new PaymentError(
      'config',
      'Stripe keys are from different accounts: STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY do not match',
    )
  }

  return { secretKey, webhookSecret, publishableKey }
}

/**
 * The webhook secret, checked separately from the rest.
 *
 * Separate because it is the one value that is legitimately absent in
 * development until `stripe listen` has been run once, and requiring it up front
 * would stop checkout working locally. It is NOT optional in production: without
 * it the webhook cannot verify a signature, so money moves and no order is ever
 * marked paid. isDeploymentReady() reports it for exactly that reason.
 */
export function hasWebhookSecret(): boolean {
  return env('STRIPE_WEBHOOK_SECRET').startsWith('whsec_')
}

/** True when the keys are test-mode. Used to gate live-money checks. */
export function isLiveKeys(): boolean {
  return env('STRIPE_SECRET_KEY').startsWith('sk_live_')
}

/**
 * The account fragment of a Stripe key: sk_test_<ACCOUNT><random>.
 */
function accountOf(key: string): string {
  const m = /^(?:sk|pk)_(?:test|live)_([A-Za-z0-9]{16})/.exec(key)
  return m ? m[1] : ''
}
