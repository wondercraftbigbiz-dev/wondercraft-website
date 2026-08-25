import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Money } from '@/lib/money'

/**
 * The database, reached through two RPCs and nothing else.
 *
 * Same discipline as lib/econt/: `server-only` at the top, so importing this
 * from a client component is a build error rather than a leaked key. That
 * matters more here than anywhere — SUPABASE_SERVICE_ROLE_KEY bypasses RLS on
 * every table, and neither it nor the URL may ever be prefixed NEXT_PUBLIC_.
 *
 * Writes only ever go through place_order() and mark_order_paid(). Both are
 * `security definer` and granted to service_role alone; they own the invariants
 * (customer upsert, order-stats triggers, the amount re-check on settlement), so
 * nothing here inserts or updates a row by hand. Reads are narrow selects of
 * non-personal columns, for the success page and for retry recovery.
 */

/** A database error that kept its Postgres SQLSTATE, so callers can branch on it. */
export class DbError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
  ) {
    super(message)
    this.name = 'DbError'
  }
}

/** Two rows collided on a unique index — here, a re-submitted payment attempt. */
export const UNIQUE_VIOLATION = '23505'

function required(name: string): string {
  const value = (process.env[name] ?? '').trim()
  if (!value) {
    // Fail on the first call rather than at import time: a missing key must not
    // take the whole site down, only the order path that needs it.
    throw new Error(`${name} is not set`)
  }
  return value
}

let client: SupabaseClient | null = null

export function db(): SupabaseClient {
  if (!client) {
    client = createClient(
      required('SUPABASE_URL'),
      required('SUPABASE_SERVICE_ROLE_KEY'),
      // No sessions, no token refresh, no storage: this runs server-side under a
      // service key, and every one of those features is a liability here.
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
  }
  return client
}

/**
 * Cents to the RPC's `numeric` euros.
 *
 * The one place money changes representation. Everywhere else in the app it is
 * integer minor units (lib/money.ts) — keep it that way, and do this conversion
 * only at this boundary, so no rounding can creep into a total.
 */
function toMajor(m: Money | null): number {
  return m ? m.cents / 100 : 0
}

/** As above, but refuses anything that is not already euros. */
function toEuros(m: Money | null): number {
  if (m && m.currency !== 'EUR') {
    throw new Error(`toEuros: expected EUR, got ${m.currency}`)
  }
  return toMajor(m)
}

export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded'

export type PlaceOrderInput = {
  email: string
  fullName: string
  phone: string
  /** Human-readable destination for the admin list; structured truth is below. */
  city: string | null
  productId: string
  productName: string
  unitPrice: Money
  unitPriceBgn: Money
  shipping: Money | null
  printName: string | null
  customization: string | null
  message: string | null
  paymentProvider: string | null
  /** Stripe Checkout Session id. Null for a phone order, which never settles. */
  providerOrderId: string | null
  attemptId: string | null
  paymentStatus: PaymentStatus
  deliveryType: string
  econtCityId: number | null
  econtCityName: string | null
  econtPostCode: string | null
  econtOfficeCode: string | null
  econtOfficeName: string | null
  street: string | null
  streetNum: string | null
  quarter: string | null
  floor: string | null
  apt: string | null
  deliveryNote: string | null
  econtUnverified: boolean
  userAgent: string | null
}

export type PlacedOrder = {
  order_id: string
  order_number: number
  customer_id: string
}

/** Upsert the customer and insert the order, in one transaction. */
export async function placeOrder(input: PlaceOrderInput): Promise<PlacedOrder> {
  const { data, error } = await db()
    .rpc('place_order', {
      p_email: input.email,
      p_full_name: input.fullName,
      p_phone: input.phone,
      p_city: input.city,
      p_product_id: input.productId,
      p_product_name: input.productName,
      p_unit_price_eur: toEuros(input.unitPrice),
      p_unit_price_bgn: toMajor(input.unitPriceBgn),
      p_shipping_eur: toEuros(input.shipping),
      p_quantity: 1,
      p_print_name: input.printName,
      p_customization: input.customization,
      p_message: input.message,
      p_marketing_consent: false,
      p_source: 'website',
      p_utm: null,
      p_user_agent: input.userAgent,
      p_payment_provider: input.paymentProvider,
      p_provider_order_id: input.providerOrderId,
      p_attempt_id: input.attemptId,
      p_payment_status: input.paymentStatus,
      p_delivery_type: input.deliveryType,
      p_econt_city_id: input.econtCityId,
      p_econt_city_name: input.econtCityName,
      p_econt_post_code: input.econtPostCode,
      p_econt_office_code: input.econtOfficeCode,
      p_econt_office_name: input.econtOfficeName,
      p_street: input.street,
      p_street_num: input.streetNum,
      p_quarter: input.quarter,
      p_floor: input.floor,
      p_apt: input.apt,
      p_delivery_note: input.deliveryNote,
      p_econt_unverified: input.econtUnverified,
    })
    .single<PlacedOrder>()

  if (error) throw new DbError(`place_order failed: ${error.message}`, error.code ?? null)
  if (!data) throw new DbError('place_order returned no row', null)
  return data
}

/** Non-personal order columns: enough to show a customer their own order. */
export type OrderSummaryRow = {
  order_number: number
  payment_status: PaymentStatus
  total_eur: number
}

const SUMMARY_COLUMNS = 'order_number, payment_status, total_eur'

/**
 * Recover the order a re-submitted attempt already created.
 *
 * attempt_id is uniquely indexed, so a double submit is a unique violation
 * rather than a second order — this is how the first one is found again.
 */
export async function findOrderByAttemptId(
  attemptId: string,
): Promise<OrderSummaryRow | null> {
  return selectOrder('attempt_id', attemptId)
}

/** Look an order up by its Stripe Checkout Session id, for the success page. */
export async function findOrderByProviderId(
  providerOrderId: string,
): Promise<OrderSummaryRow | null> {
  return selectOrder('provider_order_id', providerOrderId)
}

async function selectOrder(
  column: 'attempt_id' | 'provider_order_id',
  value: string,
): Promise<OrderSummaryRow | null> {
  const { data, error } = await db()
    .from('orders')
    .select(SUMMARY_COLUMNS)
    .eq(column, value)
    .maybeSingle<OrderSummaryRow>()

  if (error) throw new DbError(`select orders failed: ${error.message}`, error.code ?? null)
  return data ?? null
}

/**
 * What mark_order_paid() decided.
 *
 * - `paid`            — settled, status moved to confirmed.
 * - `already_paid`    — a Stripe retry landing on a row we already settled.
 * - `amount_mismatch` — the notified amount did not match total_eur. The row is
 *                       flagged payment_mismatch and needs a human.
 * - `not_found`       — no order carries this provider id. Investigate.
 */
export type SettleResult = {
  result: 'paid' | 'already_paid' | 'amount_mismatch' | 'not_found'
  order_id: string | null
  order_number: number | null
}

export async function markOrderPaid(args: {
  providerOrderId: string
  txnRef: string | null
  /** Minor units, as Stripe reports them. Converted to euros here. */
  amountCents: number
  currency: string
  raw: unknown
}): Promise<SettleResult> {
  const { data, error } = await db()
    .rpc('mark_order_paid', {
      p_provider_order_id: args.providerOrderId,
      p_txn_ref: args.txnRef,
      p_amount: args.amountCents / 100,
      p_currency: args.currency.toUpperCase(),
      p_raw: args.raw,
    })
    .single<SettleResult>()

  if (error) throw new DbError(`mark_order_paid failed: ${error.message}`, error.code ?? null)
  if (!data) throw new DbError('mark_order_paid returned no row', null)
  return data
}
