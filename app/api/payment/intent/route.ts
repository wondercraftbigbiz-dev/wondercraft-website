import { NextResponse } from 'next/server'
import type { CityDto, OfficeDto } from '@/lib/econt/dto'
import { isDeliveryType } from '@/lib/econt/dto'
import { findCity, findOffice } from '@/lib/econt/nomenclatures'
import { logFailure, rateLimitGuard } from '@/lib/econt/route-helpers'
import type { Money } from '@/lib/money'
import { hasErrors, validateOrder, type OrderDraft } from '@/lib/order/schema'
import type { OrderContext } from '@/lib/order/pricing'
import { isPaymentsConfigured } from '@/lib/payments/config'
import type { IntentResponse } from '@/lib/payments/dto'
import { createIntent } from '@/lib/payments/intent'
import { toPaymentMessageBg } from '@/lib/payments/errors'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 8 * 1024

/**
 * Open a card payment.
 *
 * The only way an order is placed. Everything the browser sent is re-validated
 * and re-priced with the same shared validator, so a bypassed client gets the
 * same Bulgarian messages rather than a divergent second set.
 *
 * This is now the only way an order is placed: card is the sole payment method.
 *
 * It fails closed, and that is deliberate. With no Econt quote there is no
 * total, and a card cannot be charged an amount nobody computed; with no
 * database write there is no record of what the money was for. Either one
 * refuses the order rather than guessing. The cost is that an Econt outage stops
 * sales outright, which is the accepted trade of having no offline fallback.
 */
export async function POST(request: Request) {
  const limited = rateLimitGuard(request, 'payment')
  if (limited) return limited

  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return json({ ok: false, reason: 'invalid', message: 'Заявката е прекалено голяма.' })
  }

  if (!isPaymentsConfigured()) {
    return json({
      ok: false,
      reason: 'unavailable',
      message: 'Плащането е временно недостъпно. Опитайте отново по-късно или ни се обадете.',
    })
  }

  let body: (OrderDraft & { attemptId?: string; expectedTotalCents?: number }) | null
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, reason: 'invalid', message: 'Невалидна заявка.' })
  }

  if (!body?.delivery || !isDeliveryType(body.delivery.type)) {
    return json({ ok: false, reason: 'invalid', message: 'Невалидна заявка.' })
  }

  const attemptId = String(body.attemptId ?? '')
  const expectedTotalCents = Number(body.expectedTotalCents)
  // A UUID from crypto.randomUUID(). Bounded so it cannot be used to smuggle
  // arbitrary text into the database or into Stripe metadata.
  if (!/^[0-9a-f-]{16,64}$/i.test(attemptId) || !Number.isInteger(expectedTotalCents)) {
    return json({ ok: false, reason: 'invalid', message: 'Невалидна заявка.' })
  }

  const { errors, value } = validateOrder({
    name: String(body.name ?? ''),
    phone: String(body.phone ?? ''),
    email: String(body.email ?? ''),
    planId: String(body.planId ?? ''),
    marketingConsent: body.marketingConsent === true,
    printName: body.printName,
    customization: body.customization,
    message: body.message,
    delivery: {
      type: body.delivery.type,
      cityId: Number(body.delivery.cityId) || null,
      officeCode: body.delivery.officeCode ?? null,
      street: body.delivery.street,
      streetNum: body.delivery.streetNum,
      quarter: body.delivery.quarter,
      floor: body.delivery.floor,
      apt: body.delivery.apt,
      note: body.delivery.note,
      streetIsFreeform: body.delivery.streetIsFreeform,
    },
  })

  if (hasErrors(errors) || !value) {
    return json({
      ok: false,
      reason: 'invalid',
      message: 'Моля, проверете данните във формата.',
      errors: errors as Record<string, string>,
    })
  }

  try {
    // Re-resolve against fresh nomenclature the browser cannot forge. A failure
    // here is fatal rather than tolerated, per the note above.
    let city: CityDto | null = null
    let office: OfficeDto | null = null

    city = (await findCity(value.delivery.cityId)) ?? null
    if (!city) {
      return json({
        ok: false,
        reason: 'invalid',
        message: 'Не разпознахме този град. Изберете го отново от списъка.',
        field: 'city',
      })
    }

    if (value.delivery.type !== 'address') {
      office = (await findOffice(city.id, String(value.delivery.officeCode))) ?? null
      if (!office) {
        return json({
          ok: false,
          reason: 'invalid',
          message:
            value.delivery.type === 'aps'
              ? 'Този автомат вече не е активен. Изберете друг.'
              : 'Този офис вече не е активен. Изберете друг.',
          field: 'officeCode',
        })
      }
    }

    const context: OrderContext = {
      city,
      office,
      rawCityId: value.delivery.cityId,
      rawOfficeCode: value.delivery.officeCode ?? null,
    }

    const result = await createIntent(value, context, {
      attemptId,
      expectedTotalCents,
      userAgent: request.headers.get('user-agent'),
    })

    if (result.kind === 'repriced') {
      return json({
        ok: false,
        reason: 'repriced',
        message: 'Цената на доставката се промени. Проверете новата сума и потвърдете.',
        total: toDto(result.total),
        shipping: toDto(result.shipping),
      })
    }

    return json({
      ok: true,
      clientSecret: result.clientSecret,
      orderRef: result.orderRef,
      total: toDto(result.total),
      shipping: toDto(result.shipping),
    })
  } catch (error) {
    logFailure(error)
    return json({
      ok: false,
      reason: 'unavailable',
      message: toPaymentMessageBg(error),
    })
  }
}

function toDto(money: Money) {
  return { cents: money.cents, currency: money.currency }
}

function json(payload: IntentResponse): NextResponse {
  return NextResponse.json(payload, {
    status: 200,
    // Carries a client secret. Never cache, anywhere, at any layer.
    headers: { 'Cache-Control': 'no-store' },
  })
}
