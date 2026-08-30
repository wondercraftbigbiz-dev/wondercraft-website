import 'server-only'

import type Stripe from 'stripe'
import { NextResponse } from 'next/server'
import { logFailure } from '@/lib/econt/route-helpers'
import { getStripe } from '@/lib/stripe/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
// Signature verification needs the byte-exact body, so nothing may cache,
// revalidate or otherwise re-serve this route.
export const dynamic = 'force-dynamic'

/**
 * Stripe's payment notifications. This is the ONLY thing that marks an order
 * paid.
 *
 * The success redirect proves only that a browser came back — it can be forged,
 * skipped by a customer who closes the tab, or arrive before the payment has
 * actually settled for a delayed method. So /order/success reads status and
 * never writes it, and everything authoritative happens here, against an event
 * Stripe signed.
 *
 * The work is done inline and the 200 is sent only after it succeeds. That is
 * deliberate: the previous implementation used a fire-and-forget background
 * task, which turned every database failure into a 200 and told Stripe to stop
 * retrying an event that had done nothing.
 */
export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return new NextResponse('Missing stripe-signature', { status: 400 })
  }

  const secret = (process.env.STRIPE_WEBHOOK_SECRET ?? '').trim()
  if (!secret) {
    // Not the caller's fault, and a 500 keeps Stripe retrying — which is what
    // we want, because the deploy is misconfigured and orders are stuck pending.
    logFailure(new Error('STRIPE_WEBHOOK_SECRET is not set'))
    return new NextResponse('Webhook secret not configured', { status: 500 })
  }

  // Raw text, not request.json(): parsing first would re-serialise the body and
  // the signature would never match.
  const body = await request.text()

  let event: Stripe.Event
  try {
    event = await getStripe().webhooks.constructEventAsync(body, signature, secret)
  } catch (error) {
    logFailure(error)
    return new NextResponse('Invalid signature', { status: 400 })
  }

  try {
    await handleEvent(event)
  } catch (error) {
    logFailure(error)
    // 500 so Stripe retries. Better a duplicate delivery — every path below is
    // idempotent — than an order that silently stays unpaid.
    return new NextResponse('Handler failed', { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      // A completed session that is not yet paid is a delayed payment method.
      // Leave the order pending and wait for the async event; settling now
      // would mark an order paid on the strength of an intention.
      if (session.payment_status === 'paid') await settle(session, event.id)
      return
    }

    case 'checkout.session.async_payment_succeeded':
      await settle(event.data.object, event.id)
      return

    case 'checkout.session.async_payment_failed':
      await fail(event.data.object, 'failed', 'Stripe reported the payment failed', event.id)
      return

    case 'checkout.session.expired':
      await fail(event.data.object, 'cancelled', 'Checkout session expired unpaid', event.id)
      return

    default:
      // Everything else is acknowledged and ignored. Subscribing to fewer event
      // types in the dashboard is the real filter; this is the safety net.
      return
  }
}

/**
 * Mark the order paid.
 *
 * mark_order_paid does the work that matters and does it under a row lock: it
 * returns 'already_paid' on a replay without touching anything, and it re-checks
 * the amount and currency against the total this server computed at checkout. A
 * mismatch is recorded and flagged for review rather than settled — so a session
 * whose amount was tampered with never turns into a shipped order.
 */
async function settle(session: Stripe.Checkout.Session, eventId: string): Promise<void> {
  if (session.amount_total === null) {
    throw new Error(`Session ${session.id} has no amount_total`)
  }

  const { data, error } = await getSupabaseAdmin().rpc('mark_order_paid', {
    p_provider_order_id: session.id,
    p_txn_ref: paymentIntentId(session),
    // Euros, not cents: the RPC compares this against the generated total_eur
    // column. Passing cents here would flag every order as a mismatch.
    p_amount: session.amount_total / 100,
    p_currency: session.currency ?? 'eur',
    p_raw: session as unknown as Record<string, unknown>,
  })

  if (error) throw new Error(`mark_order_paid failed: ${error.message}`)

  const result = rpcResult(data)

  switch (result) {
    case 'paid':
      console.log(
        JSON.stringify({ evt: 'payment.settled', eventId, session: session.id }),
      )
      return

    case 'already_paid':
      // The idempotency, and the whole reason no processed-events table is
      // needed: a redelivered event lands here and changes nothing.
      return

    case 'amount_mismatch':
      // The RPC has already set payment_mismatch and written an admin note. Loud
      // here because it means what was paid is not what we priced.
      logFailure(
        new Error(
          `Payment amount mismatch on session ${session.id}: Stripe reported ` +
            `${session.amount_total} ${session.currency}. Order flagged for review.`,
        ),
      )
      return

    case 'not_found':
      // No order carries this session id. Retrying cannot fix that, so do not
      // throw — a 500 would have Stripe redeliver this forever.
      logFailure(new Error(`No order found for Checkout Session ${session.id}`))
      return

    default:
      throw new Error(`mark_order_paid returned unexpected result: ${result}`)
  }
}

/** Record a payment that will not be completing. */
async function fail(
  session: Stripe.Checkout.Session,
  status: 'failed' | 'cancelled',
  reason: string,
  eventId: string,
): Promise<void> {
  const { data, error } = await getSupabaseAdmin().rpc('mark_order_payment_failed', {
    p_provider_order_id: session.id,
    p_status: status,
    p_reason: reason,
    p_raw: session as unknown as Record<string, unknown>,
  })

  if (error) throw new Error(`mark_order_payment_failed failed: ${error.message}`)

  const result = rpcResult(data)

  // 'already_paid' is the out-of-order delivery case: an expiry event arriving
  // after the payment settled. The RPC refuses to unsettle it, which is right —
  // not an error.
  if (result === 'not_found') {
    logFailure(new Error(`No order found for Checkout Session ${session.id}`))
    return
  }

  console.log(
    JSON.stringify({ evt: 'payment.failed', eventId, session: session.id, result }),
  )
}

/** The RPC returns a single-row table; supabase-js hands it back as an array. */
function rpcResult(data: unknown): string {
  const row = Array.isArray(data) ? data[0] : data
  return (row as { result?: string } | null)?.result ?? 'unknown'
}

function paymentIntentId(session: Stripe.Checkout.Session): string | null {
  const pi = session.payment_intent
  if (!pi) return null
  return typeof pi === 'string' ? pi : pi.id
}
