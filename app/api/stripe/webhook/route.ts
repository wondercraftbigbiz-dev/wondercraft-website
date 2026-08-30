import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!signature || !secret) return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 })

  const payload = await request.text()
  let event
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const session = event.data.object as import('stripe').Stripe.Checkout.Session
  const successful = event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded'
  const failed = event.type === 'checkout.session.async_payment_failed'
  const expired = event.type === 'checkout.session.expired'
  if (!successful && !failed && !expired) return NextResponse.json({ received: true })

  const orderRef = session.metadata?.orderRef
  if (!orderRef) return NextResponse.json({ error: 'Missing order reference' }, { status: 400 })

  const db = getSupabaseAdmin()
  const { data: order, error: lookupError } = await db
    .from('application_orders')
    .select('id,total_amount,currency,status,last_stripe_event_id')
    .eq('order_ref', orderRef)
    .maybeSingle()
  if (lookupError || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.last_stripe_event_id === event.id) return NextResponse.json({ received: true })

  if (successful && (session.amount_total !== order.total_amount || session.currency !== order.currency)) {
    return NextResponse.json({ error: 'Payment amount mismatch' }, { status: 400 })
  }

  const update = successful
    ? { status: 'paid', payment_status: session.payment_status ?? 'paid' }
    : failed
      ? { status: 'payment_failed', payment_status: session.payment_status ?? 'unpaid' }
      : { status: 'payment_expired', payment_status: 'unpaid' }

  const { error } = await db.from('application_orders').update({
    ...update,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
    last_stripe_event_id: event.id,
  }).eq('id', order.id).is('last_stripe_event_id', order.last_stripe_event_id)
  if (error) return NextResponse.json({ error: 'Could not update order' }, { status: 500 })

  return NextResponse.json({ received: true })
}
