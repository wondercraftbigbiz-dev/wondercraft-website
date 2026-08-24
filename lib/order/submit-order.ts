import 'server-only'

import { findPlan, type Plan } from '@/lib/data/pricing'
import { addMoney, eur, toEur, type Money } from '@/lib/money'
import type { CityDto, DeliveryDto, OfficeDto } from '@/lib/econt/dto'
import { logFailure } from '@/lib/econt/route-helpers'
import { calculateShipping } from '@/lib/econt/shipping'
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

/**
 * Accept an order.
 *
 * The single place an order becomes real, and the seam the next phases plug
 * into: persistOrder() becomes a database write, and a Stripe PaymentIntent
 * slots in between pricing and persistence. Everything before that point —
 * validation, authoritative pricing — already happens here, so those changes are
 * additive rather than a rewrite.
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
  const orderRef = makeOrderRef()

  await persistOrder({ orderRef, input, context, product, shipping, total, quoteId })
  await notifyOrder({ orderRef, input, total })

  return { orderRef, plan, product, shipping, total, quoteId }
}

/**
 * TODO(next phase): write to the database.
 *
 * Until then the order lives only in the logs, which is why the reference is
 * printed and shown to the customer — it is the one handle a phone call can use.
 */
async function persistOrder(record: {
  orderRef: string
  input: OrderInput
  context: OrderContext
  product: Money
  shipping: Money | null
  total: Money
  quoteId: string | null
}): Promise<void> {
  const { orderRef, input, context } = record

  // Order shape and money: safe to keep, useful for debugging pricing.
  console.log(
    JSON.stringify({
      evt: 'order.received',
      orderRef,
      planId: input.planId,
      sku: findPlan(input.planId)?.sku,
      delivery: {
        type: input.delivery.type,
        cityId: context.city?.id ?? context.rawCityId,
        cityName: context.city?.name ?? null,
        postCode: context.city?.postCode ?? null,
        officeCode: context.office?.code ?? context.rawOfficeCode ?? null,
        street: blank(input.delivery.street),
        streetNum: blank(input.delivery.streetNum),
        quarter: blank(input.delivery.quarter),
        // True when Econt was unreachable, so the destination is unverified and
        // the names above are missing. Flags the orders that need a careful
        // phone call.
        unverified: context.city === null,
      },
      money: {
        productEurCents: record.product.cents,
        shippingEurCents: record.shipping?.cents ?? null,
        totalEurCents: record.total.cents,
        quoteId: record.quoteId,
      },
      at: new Date().toISOString(),
    }),
  )

  // Personal data on a separate line, deliberately.
  //
  // TODO(privacy): this is a stopgap until the database exists. Names, phone
  // numbers and addresses in application logs have a retention life of their own
  // that nobody manages — splitting the lines means this one can be dropped or
  // routed differently without losing the order record above. Remove it the
  // moment persistOrder actually persists.
  console.log(
    JSON.stringify({
      evt: 'order.contact',
      orderRef,
      name: input.name,
      email: input.email,
      phone: input.phone,
      printName: input.printName,
      customization: input.customization,
      message: input.message,
      floor: blank(input.delivery.floor),
      apt: blank(input.delivery.apt),
      note: blank(input.delivery.note),
    }),
  )
}

/** TODO(next phase): email the shop, and confirm to the customer. */
async function notifyOrder(_record: {
  orderRef: string
  input: OrderInput
  total: Money
}): Promise<void> {
  // Intentionally empty. The phone call is the current notification channel.
}

/**
 * A short, human-quotable reference: WC-<base36 time><random>.
 *
 * Time-prefixed so references sort chronologically, and short enough to read
 * back over the phone without asking anyone to spell a UUID.
 */
/** Empty strings are noise in a log; null says "not provided". */
function blank(v: string | undefined): string | null {
  const t = (v ?? '').trim()
  return t.length > 0 ? t : null
}

function makeOrderRef(): string {
  const time = Date.now().toString(36).toUpperCase()
  const rand = Math.floor(Math.random() * 36 ** 3)
    .toString(36)
    .toUpperCase()
    .padStart(3, '0')
  return `WC-${time}${rand}`
}
