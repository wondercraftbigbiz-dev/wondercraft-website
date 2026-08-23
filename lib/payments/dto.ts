// The client-safe half of the payments integration.
//
// Everything here crosses the network to the browser, so it is deliberately
// narrow. No `server-only`: the checkout components import these types.
//
// The ONLY Stripe value that may appear in this file's payloads is
// `clientSecret`, which is scoped to a single PaymentIntent and is designed to
// reach the browser. A secret key must never be reachable from here.

import type { MoneyDto } from '@/lib/econt/dto'

export type PaymentMethod = 'card' | 'cod'

export const PAYMENT_METHODS: readonly PaymentMethod[] = ['card', 'cod'] as const

export function isPaymentMethod(v: unknown): v is PaymentMethod {
  return typeof v === 'string' && (PAYMENT_METHODS as readonly string[]).includes(v)
}

/**
 * What the browser sends to open a card payment.
 *
 * Note what is absent: an amount. Same boundary the delivery quote already
 * defends — the client names a plan and a destination, and the server prices it.
 * `expectedTotalCents` is sent only so the server can detect that the customer
 * is looking at a stale number, never to decide what to charge.
 */
export type IntentRequest = {
  /** Minted once per payment attempt, client-side. Idempotency correlation. */
  attemptId: string
  expectedTotalCents: number
}

export type IntentOk = {
  ok: true
  clientSecret: string
  orderRef: string
  total: MoneyDto
  shipping: MoneyDto
}

/** The price moved between the quote the customer saw and the charge. */
export type IntentRepriced = {
  ok: false
  reason: 'repriced'
  message: string
  total: MoneyDto
  shipping: MoneyDto
}

/** Card cannot be offered at all: no quote, Stripe off, or Stripe unreachable. */
export type IntentUnavailable = {
  ok: false
  reason: 'unavailable'
  message: string
}

export type IntentInvalid = {
  ok: false
  reason: 'invalid'
  message: string
  field?: string
  errors?: Record<string, string>
}

export type IntentResponse =
  | IntentOk
  | IntentRepriced
  | IntentUnavailable
  | IntentInvalid
