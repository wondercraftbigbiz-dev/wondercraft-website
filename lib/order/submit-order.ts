import 'server-only'

import { findPlan, type Plan } from '@/lib/data/pricing'
import { addMoney, eur, toBgn, toEur, type Money } from '@/lib/money'
import {
  DbError,
  UNIQUE_VIOLATION,
  findOrderByAttemptId,
  placeOrder,
} from '@/lib/db/client'
import type { CityDto, DeliveryDto, OfficeDto } from '@/lib/econt/dto'
import { logFailure } from '@/lib/econt/route-helpers'
import { calculateShipping } from '@/lib/econt/shipping'
import { createCheckoutSession } from './create-checkout'
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
  userAgent: string | null
}

/**
 * An order that landed in the database, and how it is being paid for.
 *
 * `kind: 'payment'` — delivery was priced, a Checkout Session exists, and the
 * customer should be sent to `redirectUrl` to pay.
 * `kind: 'phone'` — Econt could not price the delivery, so there is no total to
 * charge. The order is saved unpaid and settled by phone, exactly as before.
 */
export type AcceptedOrder = {
  orderRef: string
  orderNumber: number
  plan: Plan
  product: Money
  shipping: Money | null
  total: Money
  quoteId: string | null
} & (
  | { kind: 'payment'; redirectUrl: string }
  | { kind: 'phone'; redirectUrl: null }
)

/**
 * Accept an order.
 *
 * The single place an order becomes real. Pricing is authoritative here and
 * nowhere else: the plan price comes from lib/data/pricing.ts and the delivery
 * price from a fresh Econt quote, so the amount Stripe charges is one the server
 * computed. mark_order_paid() re-checks it again on the way back in.
 */
export async function submitOrder(
  input: OrderInput,
  context: OrderContext,
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
  // already confirms orders by phone, so refusing the sale because a third party
  // is down would lose a customer for nothing. What it must NOT do is take a
  // card payment for a total that is missing the delivery: see below.
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

  // No delivery price means no total worth charging. Save the order unpaid and
  // fall back to the phone flow rather than send someone to Stripe to pay an
  // amount we know is short by the cost of shipping it.
  if (!shipping || !input.attemptId) {
    const placed = await persistOrder({
      input,
      context,
      plan,
      product,
      // Whatever Econt did tell us is still worth saving. A quote that arrived
      // but could not be charged (no attempt id) is a price the shop can quote
      // back on the phone rather than work out again.
      shipping,
      provider: null,
      providerOrderId: null,
      paymentStatus: 'unpaid',
    })
    return {
      kind: 'phone',
      redirectUrl: null,
      orderRef: formatOrderRef(placed.orderNumber),
      orderNumber: placed.orderNumber,
      plan,
      product,
      shipping,
      total,
      quoteId,
    }
  }

  // The session first, because its id is what the order row is keyed on: the
  // webhook settles by looking the order up by provider_order_id, so a row
  // without one could never be marked paid. Both calls are idempotent on the
  // attempt id, so a retry re-finds this session rather than opening a second.
  const session = await createCheckoutSession({
    plan,
    product,
    shipping,
    email: input.email,
    attemptId: input.attemptId,
  })

  const placed = await persistOrder({
    input,
    context,
    plan,
    product,
    shipping,
    provider: 'stripe',
    providerOrderId: session.id,
    paymentStatus: 'pending',
  })

  return {
    kind: 'payment',
    redirectUrl: session.url,
    orderRef: formatOrderRef(placed.orderNumber),
    orderNumber: placed.orderNumber,
    plan,
    product,
    shipping,
    total,
    quoteId,
  }
}

/**
 * Write the order, or find the one this attempt already wrote.
 *
 * A re-submitted attempt collides on the unique attempt_id index. That is the
 * intended outcome, not an error: recover the original order and carry on, so a
 * double-click bills once and shows one reference.
 */
async function persistOrder(record: {
  input: OrderInput
  context: OrderContext
  plan: Plan
  product: Money
  shipping: Money | null
  provider: string | null
  providerOrderId: string | null
  paymentStatus: 'unpaid' | 'pending'
}): Promise<{ orderNumber: number }> {
  const { input, context, plan } = record

  try {
    const placed = await placeOrder({
      email: input.email,
      fullName: input.name,
      phone: input.phone,
      city: context.city?.name ?? null,
      productId: plan.id,
      productName: plan.name,
      unitPrice: record.product,
      unitPriceBgn: toBgn(record.product),
      shipping: record.shipping,
      printName: input.printName,
      customization: input.customization,
      message: input.message,
      paymentProvider: record.provider,
      providerOrderId: record.providerOrderId,
      attemptId: input.attemptId,
      paymentStatus: record.paymentStatus,
      deliveryType: input.delivery.type,
      econtCityId: context.city?.id ?? context.rawCityId,
      econtCityName: context.city?.name ?? null,
      econtPostCode: context.city?.postCode ?? null,
      econtOfficeCode: context.office?.code ?? context.rawOfficeCode ?? null,
      econtOfficeName: context.office?.name ?? null,
      street: input.delivery.street ?? null,
      streetNum: input.delivery.streetNum ?? null,
      quarter: input.delivery.quarter ?? null,
      floor: input.delivery.floor ?? null,
      apt: input.delivery.apt ?? null,
      deliveryNote: input.delivery.note ?? null,
      // Econt was unreachable, so the destination was never re-checked. Flags
      // the orders that need a careful confirmation call.
      econtUnverified: context.city === null,
      userAgent: context.userAgent,
    })

    // Shape and money only — no names, no phone, no address. Personal data now
    // lives in the database, where it has a retention policy, rather than in
    // application logs, where it would not.
    console.log(
      JSON.stringify({
        evt: 'order.placed',
        orderNumber: placed.order_number,
        planId: plan.id,
        sku: plan.sku,
        paymentStatus: record.paymentStatus,
        providerOrderId: record.providerOrderId,
        productEurCents: record.product.cents,
        shippingEurCents: record.shipping?.cents ?? null,
        at: new Date().toISOString(),
      }),
    )

    return { orderNumber: placed.order_number }
  } catch (error) {
    if (error instanceof DbError && error.code === UNIQUE_VIOLATION && input.attemptId) {
      const existing = await findOrderByAttemptId(input.attemptId)
      if (existing) return { orderNumber: existing.order_number }
    }
    throw error
  }
}

/**
 * The reference a customer reads back over the phone.
 *
 * The database's own sequential order_number, not a second identifier invented
 * here — so what the customer quotes is what a support query finds.
 */
export function formatOrderRef(orderNumber: number): string {
  return `WC-${String(orderNumber).padStart(4, '0')}`
}
