import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  sendCustomerOrderPaidEmail,
  sendShopOrderPaidEmail,
  type PaidOrderEmailData,
} from '@/lib/email/order-emails'

export const runtime = 'nodejs'

/**
 * Settles orders on Stripe's word, not the browser's.
 *
 * The client-side payment step only updates the UI — this endpoint is the one
 * place an order actually flips to `paid`, via the `mark_order_paid` RPC,
 * after verifying the payload really came from Stripe.
 */
export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature')
  const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET ?? '').trim()

  if (!signature || !webhookSecret) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const rawBody = await request.text()

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (error) {
    logFailure('signature_verification', error)
    return NextResponse.json({ ok: false, message: 'Invalid signature' }, { status: 400 })
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      await handleSucceeded(event.data.object as Stripe.PaymentIntent, event)
    } else if (event.type === 'payment_intent.payment_failed') {
      await handleFailed(event.data.object as Stripe.PaymentIntent)
    }
  } catch (error) {
    logFailure('webhook_handler', error)
    // A 500 makes Stripe retry the delivery. That is safe here: mark_order_paid
    // is idempotent, and a retry is exactly what a transient DB/email failure
    // needs.
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

async function handleSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  event: Stripe.Event,
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const latestCharge =
    typeof paymentIntent.latest_charge === 'string'
      ? paymentIntent.latest_charge
      : (paymentIntent.latest_charge?.id ?? null)

  const { data, error } = await supabase.rpc('mark_order_paid', {
    p_provider_order_id: paymentIntent.id,
    p_txn_ref: latestCharge,
    p_amount: paymentIntent.amount / 100,
    p_currency: paymentIntent.currency,
    p_raw: event as unknown as Record<string, unknown>,
  })

  if (error) throw new Error(`mark_order_paid failed: ${error.message}`)

  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error('mark_order_paid returned no row')

  if (row.result === 'not_found') {
    logFailure(
      'mark_order_paid',
      new Error(`No order for PaymentIntent ${paymentIntent.id}`),
    )
    return
  }

  if (row.result === 'amount_mismatch') {
    // Money moved but did not match what we quoted at checkout. The RPC
    // already flagged payment_mismatch on the row — this needs a human to
    // look, not an automatic retry.
    console.error(
      JSON.stringify({
        evt: 'payment.amount_mismatch',
        paymentIntentId: paymentIntent.id,
        orderId: row.order_id,
      }),
    )
    return
  }

  // 'already_paid' means a redelivered webhook for an order we already
  // settled and emailed — nothing left to do.
  if (row.result !== 'paid') return

  const emailData = await loadOrderForEmail(row.order_id)
  if (!emailData) return

  const results = await Promise.allSettled([
    sendShopOrderPaidEmail(emailData),
    sendCustomerOrderPaidEmail(emailData),
  ])
  for (const result of results) {
    if (result.status === 'rejected') logFailure('order_email', result.reason)
  }
}

/**
 * No RPC exists for this yet (only `mark_order_paid` does) — a direct,
 * narrowly-scoped update. Guarded to `payment_status = 'pending'` so a stale
 * or reordered webhook can never downgrade a row a later event already
 * settled to `paid`.
 */
async function handleFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('orders')
    .update({ payment_status: 'failed' })
    .eq('provider_order_id', paymentIntent.id)
    .eq('payment_status', 'pending')

  if (error) throw new Error(`Failed to record payment failure: ${error.message}`)
}

/** The shape of the joined row below. Supabase-js can't infer it without a
 * generated Database type, so this is asserted rather than inferred. */
type OrderEmailRow = {
  order_number: number
  product_name: string
  contact_name: string
  contact_phone: string
  total_eur: number | string
  shipping_eur: number | string
  delivery_type: string | null
  econt_city_name: string | null
  econt_office_name: string | null
  street: string | null
  street_num: string | null
  quarter: string | null
  floor: string | null
  apt: string | null
  delivery_note: string | null
  print_name: string | null
  customization: string | null
  message: string | null
  customers: { email: string } | { email: string }[] | null
}

async function loadOrderForEmail(
  orderId: string,
): Promise<PaidOrderEmailData | null> {
  const supabase = getSupabaseAdmin()
  const { data: rawData, error } = await supabase
    .from('orders')
    .select(
      'order_number, product_name, contact_name, contact_phone, total_eur, ' +
        'shipping_eur, delivery_type, econt_city_name, econt_office_name, ' +
        'street, street_num, quarter, floor, apt, delivery_note, print_name, ' +
        'customization, message, customers(email)',
    )
    .eq('id', orderId)
    .single()

  if (error || !rawData) {
    logFailure('load_order_for_email', error ?? new Error('order not found'))
    return null
  }

  const data = rawData as unknown as OrderEmailRow
  const customerRel = data.customers
  const customerEmail = Array.isArray(customerRel)
    ? (customerRel[0]?.email ?? null)
    : (customerRel?.email ?? null)
  if (!customerEmail) return null

  return {
    orderNumber: data.order_number,
    productName: data.product_name,
    contactName: data.contact_name,
    contactPhone: data.contact_phone,
    contactEmail: customerEmail,
    totalEur: Number(data.total_eur),
    shippingEur: Number(data.shipping_eur),
    deliveryType: data.delivery_type,
    econtCityName: data.econt_city_name,
    econtOfficeName: data.econt_office_name,
    street: data.street,
    streetNum: data.street_num,
    quarter: data.quarter,
    floor: data.floor,
    apt: data.apt,
    deliveryNote: data.delivery_note,
    printName: data.print_name,
    customization: data.customization,
    message: data.message,
  }
}

function logFailure(kind: string, error: unknown): void {
  console.error(
    JSON.stringify({
      evt: 'stripe.webhook_failure',
      kind,
      message: error instanceof Error ? error.message : String(error),
    }),
  )
}
