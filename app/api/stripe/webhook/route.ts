import type Stripe from 'stripe'
import { eur } from '@/lib/money'
import {
  markOrderPaid,
  markOrderRefunded,
  markOrderUnpaid,
} from '@/lib/order/repository'
import { getStripeConfig } from '@/lib/payments/config'
import { getStripe } from '@/lib/payments/stripe'
import { readChargeRefund, readIntentEvent } from '@/lib/payments/webhook-parse'

export const runtime = 'nodejs'
// Signature verification needs the exact bytes Stripe signed, so this route can
// never be prerendered or cached.
export const dynamic = 'force-dynamic'

/**
 * Stripe's notification that money moved.
 *
 * This is the ONLY thing in the system allowed to mark an order paid. The
 * browser's confirmPayment() result drives what the customer sees and nothing
 * else: a client cannot be trusted to declare itself paid, and it is not even
 * present for the cases that matter most — a closed tab, a lost connection, an
 * issuer that settles asynchronously.
 *
 * Deliberately NOT rate limited. Stripe retries in bursts from a small address
 * range, and a dropped event is a paid order that never gets marked paid.
 *
 * There is no auth beyond the signature, because the signature IS the auth.
 */
export async function POST(request: Request) {
  const config = getStripeConfig()
  if (config.mode !== 'live' || !config.webhookSecret) {
    // Nothing is listening in this environment. 503 rather than 200 so a
    // misconfigured deploy shows up in Stripe's dashboard as failing delivery
    // instead of silently swallowing real payments.
    return new Response('Stripe is not configured', { status: 503 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) return new Response('Missing signature', { status: 400 })

  // The raw body, not request.json(). Parsing and re-serializing changes the
  // bytes and the HMAC no longer matches.
  const raw = await request.text()

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(raw, signature, config.webhookSecret)
  } catch (error) {
    // Never echo the reason: it tells an attacker how close a forgery got.
    console.error(
      JSON.stringify({
        evt: 'stripe.webhook.bad_signature',
        message: error instanceof Error ? error.message : 'unknown',
        at: new Date().toISOString(),
      }),
    )
    return new Response('Invalid signature', { status: 400 })
  }

  try {
    await handle(event)
  } catch (error) {
    // A 500 makes Stripe retry, which is what we want for a transient database
    // failure: the event is not lost, it comes back.
    console.error(
      JSON.stringify({
        evt: 'stripe.webhook.failed',
        type: event.type,
        id: event.id,
        message: error instanceof Error ? error.message : 'unknown',
        at: new Date().toISOString(),
      }),
    )
    return new Response('Handler failed', { status: 500 })
  }

  return Response.json({ received: true })
}

async function handle(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const parsed = readIntentEvent(event.data.object)
      if (!parsed?.amountCents || parsed.currency !== 'EUR') return

      // mark_order_paid() does the work that matters, in the database, under a
      // row lock: it refuses to settle twice, and it re-checks the amount
      // against the total this server computed at checkout. A webhook that
      // reports the wrong number flags the row instead of being believed.
      const { result, orderNumber } = await markOrderPaid({
        providerOrderId: parsed.intentId,
        txnRef: parsed.intentId,
        amount: eur(parsed.amountCents),
        raw: event.data.object,
      })

      log('stripe.payment.settled', { result, orderNumber, intentId: parsed.intentId })
      return
    }

    case 'payment_intent.payment_failed': {
      const parsed = readIntentEvent(event.data.object)
      if (!parsed) return

      // Guarded in the repository to only move a still-pending row: a failure
      // from an earlier attempt can be redelivered after a success, and it must
      // never walk a paid order backwards.
      await markOrderUnpaid(parsed.intentId, 'failed', {
        code: parsed.failureCode,
        message: parsed.failureMessage,
        raw: event.data.object,
      })

      log('stripe.payment.failed', {
        intentId: parsed.intentId,
        code: parsed.failureCode,
      })
      return
    }

    case 'payment_intent.canceled': {
      const parsed = readIntentEvent(event.data.object)
      if (!parsed) return
      await markOrderUnpaid(parsed.intentId, 'cancelled', { raw: event.data.object })
      log('stripe.payment.canceled', { intentId: parsed.intentId })
      return
    }

    case 'charge.refunded': {
      // Worth handling from the start: the shop promises 14-day returns in
      // components/site/guarantee.tsx, so a refunded order is a real state.
      // Without this a refunded order reads as paid forever.
      const parsed = readChargeRefund(event.data.object)
      if (!parsed) return
      await markOrderRefunded(
        parsed.intentId,
        eur(parsed.refundedCents),
        event.data.object,
      )
      log('stripe.payment.refunded', {
        intentId: parsed.intentId,
        refundedCents: parsed.refundedCents,
      })
      return
    }

    default:
      // Acknowledge and ignore. Returning non-200 for events we did not
      // subscribe to makes Stripe retry them forever.
      return
  }
}

function log(evt: string, fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ evt, ...fields, at: new Date().toISOString() }))
}
