import 'server-only'

import { findPlan, type Plan } from '@/lib/data/pricing'
import { addMoney, eur, toEur, type Money } from '@/lib/money'
import type { CityDto, DeliveryDto, OfficeDto } from '@/lib/econt/dto'
import { logFailure } from '@/lib/econt/route-helpers'
import { calculateShipping } from '@/lib/econt/shipping'
import { placeOrder } from './repository'
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
}

/** Everything an order costs, with the destination assembled. No side effects. */
export type PricedOrder = {
  plan: Plan
  product: Money
  shipping: Money | null
  total: Money
  quoteId: string | null
  delivery: DeliveryDto
}

/**
 * Authoritative pricing.
 *
 * Split out of submitOrder so the card path can price an order without accepting
 * one: lib/payments/intent.ts needs exactly this and nothing else. Pricing is
 * genuinely identical for both payment methods, which is why it is one function
 * rather than two that drift.
 *
 * Recomputes rather than trusting the browser's total. If Econt is unreachable
 * the shipping price comes back null; what that means is the caller's decision,
 * and the two callers decide differently — see submitOrder and createIntent.
 */
export async function priceOrder(
  input: OrderInput,
  context: OrderContext,
): Promise<PricedOrder> {
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
  return { plan, product, shipping, total, quoteId, delivery }
}

/**
 * Accept a cash-on-delivery order.
 *
 * The card path does not come through here — it goes through
 * lib/payments/intent.ts, which prices the order the same way and then hands off
 * to Stripe. Both end up in the same table via lib/order/repository.ts.
 *
 * If Econt is unreachable the order still goes through with the delivery price
 * unset: this business confirms every order by phone, so refusing the sale
 * because a third party is down would lose a customer for nothing. The card path
 * cannot be so forgiving, because an unpriced delivery means no amount to charge.
 */
export async function submitOrder(
  input: OrderInput,
  context: OrderContext,
  meta?: { userAgent?: string | null },
): Promise<AcceptedOrder> {
  const priced = await priceOrder(input, context)
  const orderRef = await persistOrder(input, context, priced, meta?.userAgent ?? null)

  return {
    orderRef,
    plan: priced.plan,
    product: priced.product,
    shipping: priced.shipping,
    total: priced.total,
    quoteId: priced.quoteId,
  }
}

/**
 * Write the order and return the reference the customer is given.
 *
 * The reference is the database's own order_number, which is what the admin
 * views and the phone call both work from. A locally generated id would be a
 * second identifier for the same thing, stored nowhere.
 *
 * A database failure is logged and swallowed. Persistence is not allowed to be
 * the reason a sale is refused, so the order falls back to the log line it used
 * to live in, and the customer gets a timestamp-derived reference instead. That
 * degradation is deliberate and is alerted on via `order.persist_failed`.
 */
async function persistOrder(
  input: OrderInput,
  context: OrderContext,
  priced: PricedOrder,
  userAgent: string | null,
): Promise<string> {
  try {
    const placed = await placeOrder({
      input,
      context,
      product: priced.product,
      shipping: priced.shipping,
      provider: 'cod',
      providerOrderId: null,
      attemptId: null,
      paymentStatus: 'unpaid',
      userAgent,
      productName: priced.plan.name,
      unitPriceBgn: bgnMirror(priced.plan),
    })

    if (placed) {
      logOrder(orderRefOf(placed.orderNumber), input, context, priced, true)
      return orderRefOf(placed.orderNumber)
    }
  } catch (error) {
    logFailure(error)
    console.error(JSON.stringify({ evt: 'order.persist_failed', at: new Date().toISOString() }))
  }

  const fallback = makeOrderRef()
  logOrder(fallback, input, context, priced, false)
  return fallback
}

/**
 * Order shape and money. Safe to keep, useful for debugging pricing.
 *
 * The companion `order.contact` line that used to sit beside this one is gone:
 * it existed only because there was nowhere else to put a name and a phone
 * number, and application logs have a retention life nobody manages. Now that
 * the row is written, the personal data lives in one place that can be queried,
 * corrected and deleted on request.
 */
function logOrder(
  orderRef: string,
  input: OrderInput,
  context: OrderContext,
  priced: PricedOrder,
  persisted: boolean,
): void {
  console.log(
    JSON.stringify({
      evt: 'order.received',
      orderRef,
      persisted,
      planId: input.planId,
      sku: priced.plan.sku,
      paymentMethod: input.paymentMethod,
      delivery: {
        type: input.delivery.type,
        cityId: context.city?.id ?? context.rawCityId,
        cityName: context.city?.name ?? null,
        postCode: context.city?.postCode ?? null,
        officeCode: context.office?.code ?? context.rawOfficeCode ?? null,
        unverified: context.city === null,
      },
      money: {
        productEurCents: priced.product.cents,
        shippingEurCents: priced.shipping?.cents ?? null,
        totalEurCents: priced.total.cents,
        quoteId: priced.quoteId,
      },
      at: new Date().toISOString(),
    }),
  )
}

/** "WC-1042" — short, human-quotable, and the number the admin list shows. */
export function orderRefOf(orderNumber: number): string {
  return `WC-${orderNumber}`
}

/** The lev display mirror, as a number for the numeric column. */
function bgnMirror(plan: Plan): number {
  return Number(plan.lev.replace(/[^\d,]/g, '').replace(',', '.'))
}

/**
 * Fallback reference, used only when the database write did not happen.
 *
 * Time-prefixed so references still sort chronologically, and short enough to
 * read back over the phone. Distinguishable from a real one by having letters
 * after the prefix, which is a useful signal when someone calls with it.
 */
export function makeOrderRef(): string {
  const time = Date.now().toString(36).toUpperCase()
  const rand = Math.floor(Math.random() * 36 ** 3)
    .toString(36)
    .toUpperCase()
    .padStart(3, '0')
  return `WC-${time}${rand}`
}
