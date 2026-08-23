import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { Money } from '@/lib/money'
import type { OrderInput } from './schema'
import type { OrderContext } from './submit-order'

/**
 * The only module that talks to the orders database.
 *
 * Everything goes through two SECURITY DEFINER functions rather than table
 * writes: place_order() upserts the customer and inserts the order atomically,
 * and mark_order_paid() settles a payment under a row lock. Both live in the
 * database because that is where the concurrency is — a webhook retry and a
 * browser confirmation can arrive at the same instant, and a `for update` in
 * plpgsql is a great deal harder to get wrong than a read-modify-write here.
 *
 * Money crosses this boundary as a decimal, because the schema stores numeric.
 * lib/money.ts remains integer cents everywhere above this line; the division
 * happens here and nowhere else.
 */

export type PlacedOrder = {
  orderId: string
  orderNumber: number
  customerId: string
}

/** numeric(x.xx) from integer minor units. The one place cents become decimals. */
function toDecimal(m: Money): number {
  return m.cents / 100
}

type PlaceArgs = {
  input: OrderInput
  context: OrderContext
  product: Money
  shipping: Money | null
  /** 'cod' or 'card'. */
  provider: 'cod' | 'stripe'
  /**
   * Our handle at the provider. For COD there is none. For card this is the
   * attempt id at insert time, replaced by the PaymentIntent id once Stripe has
   * issued one — see attachIntent().
   */
  providerOrderId: string | null
  paymentStatus: 'unpaid' | 'pending'
  userAgent: string | null
  /** Snapshotted at order time, so a later rename does not rewrite history. */
  productName: string
  /** The lev display mirror from lib/data/pricing.ts, stored alongside. */
  unitPriceBgn: number
}

/**
 * Insert an order and upsert its customer.
 *
 * Returns null when the database is unreachable or unconfigured. Callers must
 * treat that as "log it and carry on", never as a reason to refuse the sale:
 * this shop confirms every order by phone anyway, and losing a customer because
 * Postgres is having a bad minute would be a self-inflicted wound.
 */
export async function placeOrder(args: PlaceArgs): Promise<PlacedOrder | null> {
  const db = getSupabaseAdmin()
  if (!db) return null

  const { input, context, product, shipping } = args
  const d = input.delivery

  const { data, error } = await db.rpc('place_order', {
    p_email: input.email,
    p_full_name: input.name,
    p_phone: input.phone,
    p_city: context.city?.name ?? null,

    p_product_id: input.planId,
    p_product_name: args.productName,
    p_unit_price_eur: toDecimal(product),
    p_unit_price_bgn: args.unitPriceBgn,
    p_shipping_eur: shipping ? toDecimal(shipping) : 0,
    p_quantity: 1,

    p_print_name: input.printName,
    p_customization: input.customization,
    p_message: input.message,

    p_marketing_consent: input.marketingConsent,
    p_source: 'website',
    p_user_agent: args.userAgent,

    p_payment_provider: args.provider,
    p_provider_order_id: args.providerOrderId,
    p_payment_status: args.paymentStatus,

    p_delivery_type: d.type,
    p_econt_city_id: context.city?.id ?? context.rawCityId,
    p_econt_city_name: context.city?.name ?? null,
    p_econt_post_code: context.city?.postCode ?? null,
    p_econt_office_code: context.office?.code ?? context.rawOfficeCode ?? null,
    p_econt_office_name: context.office?.name ?? null,
    p_street: d.street ?? null,
    p_street_num: d.streetNum ?? null,
    p_quarter: d.quarter ?? null,
    p_floor: d.floor ?? null,
    p_apt: d.apt ?? null,
    p_delivery_note: d.note ?? null,
    // True when Econt was unreachable, so the destination was never re-checked.
    // These orders need a careful confirmation call.
    p_econt_unverified: context.city === null,
  })

  if (error) throw new Error(`place_order failed: ${error.message}`)

  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null

  return {
    orderId: String(row.order_id),
    orderNumber: Number(row.order_number),
    customerId: String(row.customer_id),
  }
}

/**
 * Swap the attempt id for the real PaymentIntent id.
 *
 * The row is written before Stripe is called, so that a Stripe failure leaves an
 * unpaid orphan rather than a charge with no record. That ordering means the row
 * is briefly keyed on the attempt id; this closes the gap. The webhook falls
 * back to the attempt id (carried in intent metadata) if this update was lost.
 */
export async function attachIntent(
  attemptId: string,
  intentId: string,
): Promise<void> {
  const db = getSupabaseAdmin()
  if (!db) return

  const { error } = await db
    .from('orders')
    .update({ provider_order_id: intentId })
    .eq('provider_order_id', attemptId)

  if (error) throw new Error(`attachIntent failed: ${error.message}`)
}

export type SettleResult = 'paid' | 'already_paid' | 'amount_mismatch' | 'not_found'

/**
 * Settle a payment. Idempotent by construction: the function row-locks, returns
 * 'already_paid' for a replay, and verifies the amount against the total the
 * server computed at checkout before it will mark anything paid.
 */
export async function markOrderPaid(args: {
  providerOrderId: string
  txnRef: string | null
  amount: Money
  raw: unknown
}): Promise<{ result: SettleResult; orderNumber: number | null }> {
  const db = getSupabaseAdmin()
  if (!db) return { result: 'not_found', orderNumber: null }

  const { data, error } = await db.rpc('mark_order_paid', {
    p_provider_order_id: args.providerOrderId,
    p_txn_ref: args.txnRef,
    p_amount: toDecimal(args.amount),
    p_currency: args.amount.currency,
    p_raw: args.raw ?? null,
  })

  if (error) throw new Error(`mark_order_paid failed: ${error.message}`)

  const row = Array.isArray(data) ? data[0] : data
  return {
    result: (row?.result ?? 'not_found') as SettleResult,
    orderNumber: row?.order_number != null ? Number(row.order_number) : null,
  }
}

/** Record a failed or cancelled attempt. Never downgrades a paid row. */
export async function markOrderUnpaid(
  providerOrderId: string,
  status: 'failed' | 'cancelled',
  detail: { code?: string | null; message?: string | null; raw?: unknown },
): Promise<void> {
  const db = getSupabaseAdmin()
  if (!db) return

  const { error } = await db
    .from('orders')
    .update({
      payment_status: status,
      payment_raw: detail.raw ?? null,
      admin_notes: detail.message ?? null,
    })
    .eq('provider_order_id', providerOrderId)
    // A payment_failed event from an earlier attempt can be redelivered after a
    // succeeded one. Only a still-pending row may move.
    .eq('payment_status', 'pending')

  if (error) throw new Error(`markOrderUnpaid failed: ${error.message}`)
}
