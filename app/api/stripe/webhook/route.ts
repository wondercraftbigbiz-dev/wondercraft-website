import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { markOrderPaid } from '@/lib/db/client'
import { logFailure } from '@/lib/econt/route-helpers'
import { getStripe, webhookSecret } from '@/lib/stripe/client'

export const runtime = 'nodejs'
/** Stripe posts here directly; nothing about this response is cacheable. */
export const dynamic = 'force-dynamic'

/**
 * Stripe's payment notifications.
 *
 * This is the only place an order is marked paid. The success page the customer
 * lands on is a redirect they could type themselves, so it proves nothing; a
 * signed webhook is the only statement from Stripe we accept.
 *
 * Deliberately not rate-limited, unlike the other routes: Stripe retries a
 * failed delivery for days, and dropping those retries would strand paid orders
 * as pending.
 */
export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature')
  if (!signature) return bad('missing signature')

  // The raw bytes, never request.json(): the signature is computed over the
  // exact body Stripe sent, and re-serializing parsed JSON would not reproduce it.
  const payload = await request.text()

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, webhookSecret())
  } catch (error) {
    // An unverified payload is not a Stripe event and gets read no further.
    logFailure(error)
    return bad('invalid signature')
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await settle(event.data.object, event)
        break
      default:
        // Everything else is acknowledged and ignored, so Stripe stops retrying
        // events this endpoint has no opinion about.
        break
    }
  } catch (error) {
    // A 500 asks Stripe to retry, which is what we want for a transient database
    // failure — the settlement RPC is idempotent, so a replay is safe.
    logFailure(error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

/**
 * Record the payment.
 *
 * The amount is not trusted from here either: mark_order_paid() re-checks it
 * against the total the server computed at checkout, and flags the row rather
 * than settling if they disagree.
 */
async function settle(session: Stripe.Checkout.Session, event: Stripe.Event) {
  // `unpaid` reaches us for delayed payment methods; only `paid` settles.
  if (session.payment_status !== 'paid') return
  if (typeof session.amount_total !== 'number' || !session.currency) {
    throw new Error(`Session ${session.id} completed with no amount`)
  }

  const result = await markOrderPaid({
    providerOrderId: session.id,
    txnRef: paymentIntentId(session),
    amountCents: session.amount_total,
    currency: session.currency,
    raw: event as unknown,
  })

  // `paid` and `already_paid` are both fine — the second is a Stripe retry
  // landing on a row this endpoint already settled. `amount_mismatch` means the
  // row is flagged and needs a human; `not_found` means a session was created
  // without its order row ever being written.
  console.log(
    JSON.stringify({
      evt: 'payment.settled',
      result: result.result,
      orderNumber: result.order_number,
      sessionId: session.id,
      amountCents: session.amount_total,
      currency: session.currency,
      at: new Date().toISOString(),
    }),
  )
}

function paymentIntentId(session: Stripe.Checkout.Session): string | null {
  const pi = session.payment_intent
  if (!pi) return null
  return typeof pi === 'string' ? pi : pi.id
}

function bad(reason: string): NextResponse {
  return NextResponse.json({ ok: false, error: reason }, { status: 400 })
}
