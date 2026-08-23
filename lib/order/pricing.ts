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
 * `city` is null when Econt was unreachable. Card payment refuses such an order
 * (no quote means no amount to charge), but the raw identifiers the browser sent
 * are kept so the failure can be diagnosed and quoted by hand if needed.
 */
export type OrderContext = {
  city: CityDto | null
  office: OfficeDto | null
  rawCityId: number
  rawOfficeCode: string | null
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
 * Recomputes rather than trusting the browser's total: the browser is where a
 * customer's data is typed, not where it is trusted, and the total it shows was
 * computed from a quote that may since have expired.
 *
 * Shipping comes back null when Econt could not price the parcel. The only
 * caller, createIntent(), treats that as fatal — with no delivery price there is
 * no total, and a card cannot be charged an amount nobody computed.
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
 * "WC-1042" — short, human-quotable, and the number the admin list shows.
 *
 * Derived from the database's own order_number rather than generated here, so
 * there is exactly one identifier for an order rather than two that must be kept
 * in step.
 */
export function orderRefOf(orderNumber: number): string {
  return `WC-${orderNumber}`
}
