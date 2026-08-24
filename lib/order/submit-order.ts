import 'server-only'

import { findPlan, type Plan } from '@/lib/data/pricing'
import { addMoney, eur, toBgn, toEur, type Money } from '@/lib/money'
import type { CityDto, DeliveryDto, OfficeDto } from '@/lib/econt/dto'
import { logFailure } from '@/lib/econt/route-helpers'
import { calculateShipping } from '@/lib/econt/shipping'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/server'
import type { OrderInput } from './schema'

/**
 * The resolved destination, or as much of it as Econt would tell us.
 *
 * `city` is null when Econt was unreachable at submit time. The order is still
 * accepted — see the note in submitOrder — so the raw identifiers the browser
 * sent are kept for the follow-up phone call.
 */
export type OrderContext = {
  city: CityDto | null
  office: OfficeDto | null
  rawCityId: number
  rawOfficeCode: string | null
}

export type AcceptedOrder = {
  orderRef: string
  plan: Plan
  product: Money
  /** Null when Econt could not price it; we confirm by phone in that case. */
  shipping: Money | null
  total: Money
  quoteId: string | null
  /** Mount a Stripe Payment Element against this to collect payment. */
  clientSecret: string
}

/**
 * Accept an order and open a Stripe PaymentIntent for it.
 *
 * Order of operations matters: the PaymentIntent is created first (idempotent
 * on `input.attemptId`, so a retried submit reuses the same one instead of
 * charging twice), then `place_order` stores its id as `provider_order_id` —
 * the column `mark_order_paid` later locks the row by, from the webhook.
 */
export async function submitOrder(
  input: OrderInput,
  context: OrderContext,
  userAgent: string | null,
): Promise<AcceptedOrder> {
  const plan = findPlan(input.planId)
  if (!plan) throw new Error(`Unknown plan ${input.planId}`)

  const product = eur(plan.priceEurCents)
  const delivery: DeliveryDto = {
    type: input.delivery.type,
    cityId: context.city?.id ?? context.rawCityId,
    officeCode: context.office?.code ?? context.rawOfficeCode ?? undefined,
    street: input.delivery.street,
    streetNum: input.delivery.streetNum,
    quarter: input.delivery.quarter,
    floor: input.delivery.floor,
    apt: input.delivery.apt,
    note: input.delivery.note,
    streetIsFreeform: input.delivery.streetIsFreeform,
  }

  // Recompute rather than trust the browser's total. If Econt is unreachable the
  // order still goes through with the delivery price unset — this business
  // already confirms every order by phone, so refusing the sale because a third
  // party is down would lose a customer for nothing.
  let shipping: Money | null = null
  let quoteId: string | null = null
  if (context.city) {
    try {
      const quote = await calculateShipping({
        plan,
        city: context.city,
        office: context.office,
        delivery,
        receiver: { name: input.name, phone: input.phone },
      })
      shipping = toEur(quote.shipping)
      quoteId = quote.quoteId
    } catch (error) {
      logFailure(error)
    }
  }

  const total = shipping ? addMoney(product, shipping) : product

  const stripe = getStripe()
  // total.cents is already eurocents — Stripe's minor unit for EUR — so no
  // conversion. idempotencyKey ties this to the attempt: a retried submit
  // with the same attemptId gets back the same PaymentIntent instead of a
  // second charge.
  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: total.cents,
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
      description: `WonderCraft — ${plan.name}`,
      receipt_email: input.email,
    },
    { idempotencyKey: input.attemptId },
  )

  const { orderNumber } = await placeOrder({
    input,
    context,
    product,
    shipping,
    paymentIntentId: paymentIntent.id,
    userAgent,
  })

  const orderRef = `WC-${orderNumber}`

  // Best-effort: lets the Stripe Dashboard show which order a payment belongs
  // to. Never block the checkout on this succeeding.
  stripe.paymentIntents
    .update(paymentIntent.id, { metadata: { orderRef, orderNumber: String(orderNumber) } })
    .catch(logFailure)

  if (!paymentIntent.client_secret) {
    throw new Error('Stripe did not return a client secret for the PaymentIntent')
  }

  return {
    orderRef,
    plan,
    product,
    shipping,
    total,
    quoteId,
    clientSecret: paymentIntent.client_secret,
  }
}

/**
 * Insert the order row via the `place_order` RPC, keyed on `attemptId`.
 *
 * A retried submit (same attemptId, e.g. after a dropped response) hits the
 * unique index on `orders.attempt_id` — that is not an error, it means the
 * first attempt already landed, so look the row up and reuse it instead of
 * failing the retry.
 */
async function placeOrder(args: {
  input: OrderInput
  context: OrderContext
  product: Money
  shipping: Money | null
  paymentIntentId: string
  userAgent: string | null
}): Promise<{ orderNumber: number }> {
  const { input, context, product, shipping, paymentIntentId, userAgent } = args
  const plan = findPlan(input.planId)
  if (!plan) throw new Error(`Unknown plan ${input.planId}`)

  const supabase = getSupabaseAdmin()
  const rpcArgs = {
    p_email: input.email,
    p_full_name: input.name,
    p_phone: input.phone,
    p_city: context.city?.name ?? null,
    p_product_id: plan.sku,
    p_product_name: plan.name,
    p_unit_price_eur: product.cents / 100,
    p_unit_price_bgn: toBgn(product).cents / 100,
    p_shipping_eur: shipping ? shipping.cents / 100 : 0,
    p_quantity: 1,
    p_print_name: input.printName,
    p_customization: input.customization,
    p_message: input.message,
    p_marketing_consent: false,
    p_source: 'website',
    p_utm: null,
    p_user_agent: userAgent,
    p_payment_provider: 'stripe',
    p_provider_order_id: paymentIntentId,
    p_attempt_id: input.attemptId,
    p_payment_status: 'pending',
    p_delivery_type: input.delivery.type,
    p_econt_city_id: context.city?.id ?? context.rawCityId,
    p_econt_city_name: context.city?.name ?? null,
    p_econt_post_code: context.city?.postCode ?? null,
    p_econt_office_code: context.office?.code ?? context.rawOfficeCode ?? null,
    p_econt_office_name: context.office?.name ?? null,
    p_street: input.delivery.street ?? null,
    p_street_num: input.delivery.streetNum ?? null,
    p_quarter: input.delivery.quarter ?? null,
    p_floor: input.delivery.floor ?? null,
    p_apt: input.delivery.apt ?? null,
    p_delivery_note: input.delivery.note ?? null,
    p_econt_unverified: context.city === null,
  }

  const { data, error } = await supabase.rpc('place_order', rpcArgs)

  if (error) {
    // 23505 = unique_violation. Only attempt_id is expected to collide on a
    // legitimate retry — provider_order_id colliding here would mean Stripe
    // handed back someone else's PaymentIntent id, which should fail loudly.
    if (error.code === '23505' && error.message.includes('attempt_id')) {
      const existing = await supabase
        .from('orders')
        .select('order_number')
        .eq('attempt_id', input.attemptId)
        .single()
      if (existing.data) return { orderNumber: existing.data.order_number }
    }
    throw new Error(`place_order failed: ${error.message}`)
  }

  const row = Array.isArray(data) ? data[0] : data
  return { orderNumber: row.order_number }
}
