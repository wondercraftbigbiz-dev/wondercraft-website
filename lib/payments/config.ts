import 'server-only'

import { PaymentError } from './errors'

export type StripeMode = 'live' | 'disabled'

export type StripeConfig = {
  mode: StripeMode
  secretKey: string
  webhookSecret: string
  publishableKey: string
}

function env(name: string): string {
  return (process.env[name] ?? '').trim()
}

/**
 * Read and validate configuration.
 *
 * Defaults to `disabled`, which is what makes a fresh clone and every sandbox
 * behave exactly as the site did before payments existed: the card option never
 * renders, the intent route answers "unavailable", and the webhook refuses. Same
 * reasoning as ECONT_MODE=fixture being the default.
 *
 * "live" here means "Stripe is switched on", not "live keys". Test keys in live
 * mode is the normal state until the account is activated — see CLAUDE.md.
 */
export function getStripeConfig(): StripeConfig {
  const mode: StripeMode = env('STRIPE_MODE') === 'live' ? 'live' : 'disabled'
  const secretKey = env('STRIPE_SECRET_KEY')
  const webhookSecret = env('STRIPE_WEBHOOK_SECRET')
  const publishableKey = env('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')

  if (mode === 'live') {
    // The webhook secret is deliberately NOT required here. It is only needed by
    // the webhook route, which checks it itself, and requiring it up front would
    // stop checkout working locally before `stripe listen` has been run once.
    const missing: string[] = []
    if (!secretKey) missing.push('STRIPE_SECRET_KEY')
    if (!publishableKey) missing.push('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')
    if (missing.length > 0) {
      throw new PaymentError(
        'config',
        `Stripe is in live mode but misconfigured: missing ${missing.join(', ')}`,
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
  }

  return { mode, secretKey, webhookSecret, publishableKey }
}

/** True when the keys are test-mode. Used to label the UI, never to gate logic. */
export function isTestMode(config: StripeConfig): boolean {
  return config.secretKey.startsWith('sk_test_')
}

/**
 * The account fragment of a Stripe key: sk_test_<ACCOUNT><random>.
 * Keys are `sk_test_51ABC...`, and the account id follows the mode prefix.
 */
function accountOf(key: string): string {
  const m = /^(?:sk|pk)_(?:test|live)_([A-Za-z0-9]{16})/.exec(key)
  return m ? m[1] : ''
}
