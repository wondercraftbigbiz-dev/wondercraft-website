import 'server-only'

import { DISPATCH_IS_PLACEHOLDER } from '@/lib/data/dispatch'
import { PARCEL_IS_PLACEHOLDER, isParcelConfigured } from '@/lib/data/pricing'
import { getEcontConfig } from '@/lib/econt/config'
import { hasWebhookSecret, isLiveKeys, isPaymentsConfigured } from './config'
import { PaymentError } from './errors'

/**
 * One named problem with a deployment.
 *
 * `blocksLiveCharge` is the distinction that matters: some of these are merely
 * "not ready for launch", and one of them means real money would be taken
 * against a number nobody measured.
 */
export type ReadinessIssue = {
  /** What to set. A name, never a value. */
  key: string
  /** What goes wrong if it is left as-is. */
  consequence: string
  blocksLiveCharge: boolean
}

/**
 * The facts a readiness verdict depends on.
 *
 * Gathered separately from the judgement so the judgement can be tested. Every
 * one of these is a module constant or an environment read, none of which a
 * test can vary — which is precisely how both placeholder flags came to be
 * unread at request time without anything noticing.
 */
export type ReadinessFacts = {
  paymentsConfigured: boolean
  webhookSecret: boolean
  /** null when Econt config itself throws; the message is carried separately. */
  econtMode: 'live' | 'fixture' | null
  econtError: string | null
  parcelPlaceholder: boolean
  dispatchPlaceholder: boolean
}

/** Pure. Given the facts, what stands in the way. */
export function evaluateReadiness(facts: ReadinessFacts): ReadinessIssue[] {
  const issues: ReadinessIssue[] = []

  if (!facts.paymentsConfigured) {
    issues.push({
      key: 'STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      consequence: 'Card payment is off; no order can be placed.',
      blocksLiveCharge: false,
    })
  }

  if (!facts.webhookSecret) {
    issues.push({
      key: 'STRIPE_WEBHOOK_SECRET',
      consequence:
        'Payments would be taken but never settle: the webhook cannot verify a signature, so orders stay pending forever.',
      blocksLiveCharge: false,
    })
  }

  if (facts.econtError) {
    issues.push({
      key: 'ECONT_BASE_URL, ECONT_USERNAME, ECONT_PASSWORD',
      consequence: facts.econtError,
      blocksLiveCharge: true,
    })
  }

  if (facts.econtMode !== 'live') {
    issues.push({
      key: 'ECONT_MODE',
      consequence:
        'Delivery prices are invented by the fixture client (5.90 + weight x 0.60 BGN), not quoted by Econt.',
      blocksLiveCharge: true,
    })
  }

  if (facts.parcelPlaceholder) {
    issues.push({
      key: 'PACKED_PARCEL (lib/data/pricing.ts)',
      consequence:
        'Delivery is priced from a guessed box. Every order is wrong by an unknown amount, absorbed by the shop.',
      blocksLiveCharge: true,
    })
  }

  if (facts.dispatchPlaceholder) {
    issues.push({
      key: 'DISPATCH (lib/data/dispatch.ts)',
      consequence:
        'Parcels have no real origin. The quote is priced from the wrong place and the label would be rejected.',
      blocksLiveCharge: true,
    })
  }

  return issues
}

/**
 * Read the facts from this deployment.
 *
 * getEcontConfig() throws when live mode is half-configured, which is itself a
 * readiness problem rather than something to crash on.
 */
export function gatherFacts(): ReadinessFacts {
  let econtMode: ReadinessFacts['econtMode'] = null
  let econtError: string | null = null
  try {
    econtMode = getEcontConfig().mode
  } catch (error) {
    econtError = error instanceof Error ? error.message : 'Econt is misconfigured.'
  }

  return {
    paymentsConfigured: isPaymentsConfigured(),
    webhookSecret: hasWebhookSecret(),
    econtMode,
    econtError,
    parcelPlaceholder: PARCEL_IS_PLACEHOLDER || !isParcelConfigured(),
    dispatchPlaceholder: DISPATCH_IS_PLACEHOLDER,
  }
}

/**
 * Everything standing between this deployment and taking real orders.
 *
 * Returns names and consequences only — no secret values, and every name here
 * already appears in .env.example in a public repository, so this is safe to
 * expose from /api/health. That endpoint exists because the alternative way to
 * discover a misconfiguration was for a customer to hit it mid-order.
 */
export function readinessIssues(): ReadinessIssue[] {
  return evaluateReadiness(gatherFacts())
}

export function isDeploymentReady(): boolean {
  return readinessIssues().length === 0
}

/**
 * Refuse to charge a real card against a deployment that cannot price one.
 *
 * This is what makes PARCEL_IS_PLACEHOLDER and DISPATCH_IS_PLACEHOLDER
 * load-bearing rather than decorative. Both flags were introduced with a comment
 * and a warning in a check script, and neither was ever read at request time —
 * so a production deploy would have quoted, charged and shipped at a guessed
 * weight from a guessed origin, with nothing looking wrong at the time.
 *
 * Only enforced for `sk_live_` keys. With test keys everything below is allowed,
 * because that is exactly the situation the placeholders exist to support:
 * clicking the flow through before the real numbers are known.
 */
export function assertChargeable(): void {
  if (!isLiveKeys()) return

  const blocking = readinessIssues().filter((i) => i.blocksLiveCharge)
  if (blocking.length === 0) return

  throw new PaymentError(
    'config',
    `Refusing to charge a live card: ${blocking.map((i) => i.key).join('; ')}`,
    { detail: { blocking } },
  )
}
