import { NextResponse } from 'next/server'
import { findPlan } from '@/lib/data/pricing'
import { addMoney, eur, toEur, type Money } from '@/lib/money'
import type { MoneyDto, QuoteRequest, QuoteResponse } from '@/lib/econt/dto'
import { isDeliveryType } from '@/lib/econt/dto'
import { toUserMessageBg } from '@/lib/econt/errors'
import { findCity, findOffice } from '@/lib/econt/nomenclatures'
import { logFailure, rateLimitGuard } from '@/lib/econt/route-helpers'
import { calculateShipping } from '@/lib/econt/shipping'
import { validateDelivery } from '@/lib/order/schema'
import { isEcontError } from '@/lib/econt/errors'

export const runtime = 'nodejs'

/** The quote is advisory for five minutes; the order route recomputes anyway. */
const QUOTE_TTL_MS = 5 * 60 * 1000
const MAX_BODY_BYTES = 8 * 1024

/**
 * Price the delivery for a plan and a destination.
 *
 * The request names a plan and nothing else about the product. Weight,
 * dimensions, pack count and declared value are all read server-side from
 * lib/data/pricing.ts.
 *
 * This is the pricing-integrity boundary, and it is the constraint most likely
 * to be relaxed by a well-meaning future change: if the client could send
 * `weight`, it could quote itself free shipping, and once Stripe is wired up,
 * underpay. Do not accept product fields here.
 *
 * Business outcomes answer 200 with { ok: false }, so the client has one error
 * path. 4xx is reserved for malformed requests, 429 for rate limits.
 */
export async function POST(request: Request) {
  const limited = rateLimitGuard(request, 'quote')
  if (limited) return limited

  const length = Number(request.headers.get('content-length') ?? 0)
  if (length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, message: 'Невалидна заявка.' }, { status: 413 })
  }

  let body: QuoteRequest
  try {
    body = (await request.json()) as QuoteRequest
  } catch {
    return NextResponse.json({ ok: false, message: 'Невалидна заявка.' }, { status: 400 })
  }

  const plan = findPlan(String(body?.planId ?? ''))
  if (!plan) {
    return NextResponse.json({ ok: false, message: 'Невалидна заявка.' }, { status: 400 })
  }

  const delivery = body?.delivery
  if (!delivery || !isDeliveryType(delivery.type)) {
    return NextResponse.json({ ok: false, message: 'Невалидна заявка.' }, { status: 400 })
  }

  // The same validator the browser ran. A request that skipped it gets the same
  // Bulgarian messages back rather than a second, divergent set.
  const errors = validateDelivery({
    type: delivery.type,
    cityId: Number(delivery.cityId) || null,
    officeCode: delivery.officeCode ?? null,
    street: delivery.street,
    streetNum: delivery.streetNum,
    quarter: delivery.quarter,
    streetIsFreeform: delivery.streetIsFreeform,
  })
  const firstError = Object.entries(errors)[0]
  if (firstError) {
    return json({ ok: false, message: firstError[1], field: firstError[0] })
  }

  try {
    const city = await findCity(Number(delivery.cityId))
    if (!city) {
      return json({
        ok: false,
        message: 'Не разпознахме този град. Изберете го отново от списъка.',
        field: 'city',
      })
    }

    const office =
      delivery.type === 'address'
        ? null
        : ((await findOffice(city.id, String(delivery.officeCode))) ?? null)

    // The client may be working from a cache that has gone stale — an office
    // Econt has since closed or renamed.
    if (delivery.type !== 'address' && !office) {
      return json({
        ok: false,
        message:
          delivery.type === 'aps'
            ? 'Този автомат вече не е активен. Изберете друг.'
            : 'Този офис вече не е активен. Изберете друг.',
        field: 'officeCode',
      })
    }

    const quote = await calculateShipping({
      plan,
      city,
      office,
      delivery: {
        type: delivery.type,
        cityId: city.id,
        officeCode: office?.code,
        street: delivery.street,
        streetNum: delivery.streetNum,
        quarter: delivery.quarter,
        floor: delivery.floor,
        apt: delivery.apt,
        note: delivery.note,
        streetIsFreeform: delivery.streetIsFreeform,
      },
      // Econt requires a receiver to price a shipment, but the name and phone do
      // not affect the price, so a placeholder keeps personal data out of the
      // quote path entirely. The real receiver is sent when the order is placed.
      receiver: { name: 'Получател', phone: '+359000000000' },
    })

    const product = eur(plan.priceEurCents)
    const shipping = toEur(quote.shipping)

    return json({
      ok: true,
      product: toDto(product),
      shipping: toDto(shipping),
      total: toDto(addMoney(product, shipping)),
      quoteId: quote.quoteId,
      expiresAt: Date.now() + QUOTE_TTL_MS,
    })
  } catch (error) {
    logFailure(error)
    return json({
      ok: false,
      message: toUserMessageBg(error),
      field: isEcontError(error) ? error.field : undefined,
    })
  }
}

function toDto(money: Money): MoneyDto {
  return { cents: money.cents, currency: money.currency }
}

function json(payload: QuoteResponse): NextResponse {
  return NextResponse.json(payload, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}
