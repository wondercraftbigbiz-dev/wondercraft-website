import { NextResponse } from 'next/server'
import type { MoneyDto, OrderResponse } from '@/lib/econt/dto'
import { isDeliveryType } from '@/lib/econt/dto'
import { findCity, findOffice } from '@/lib/econt/nomenclatures'
import { logFailure, rateLimitGuard } from '@/lib/econt/route-helpers'
import type { Money } from '@/lib/money'
import { hasErrors, validateOrder, type OrderDraft } from '@/lib/order/schema'
import { submitOrder, type OrderContext } from '@/lib/order/submit-order'
import type { CityDto, OfficeDto } from '@/lib/econt/dto'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 8 * 1024

/**
 * Place an order.
 *
 * Everything the browser sent is re-validated and re-priced here. That is not
 * belt-and-braces: the browser is where a customer's data is typed, not where it
 * is trusted, and the total shown to them was computed from a quote that may
 * have expired.
 *
 * On success the order is written to the database and, when Econt priced the
 * delivery, a Stripe Checkout Session is created and its URL returned for the
 * browser to redirect to. If the delivery could not be priced there is no total
 * worth charging, so the order is saved unpaid and the shop's existing
 * "we'll call you" flow takes over — see submitOrder.
 */
export async function POST(request: Request) {
  const limited = rateLimitGuard(request, 'order')
  if (limited) return limited

  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json(
      { ok: false, message: 'Заявката е прекалено голяма.' },
      { status: 413 },
    )
  }

  let draft: OrderDraft
  try {
    draft = (await request.json()) as OrderDraft
  } catch {
    return NextResponse.json({ ok: false, message: 'Невалидна заявка.' }, { status: 400 })
  }

  if (!draft?.delivery || !isDeliveryType(draft.delivery.type)) {
    return NextResponse.json({ ok: false, message: 'Невалидна заявка.' }, { status: 400 })
  }

  // The same validator the browser ran, so a bypassed client gets the same
  // messages rather than a divergent second set.
  const { errors, value } = validateOrder({
    firstName: String(draft.firstName ?? ''),
    lastName: String(draft.lastName ?? ''),
    email: String(draft.email ?? ''),
    phone: String(draft.phone ?? ''),
    planId: String(draft.planId ?? ''),
    printName: draft.printName,
    customization: draft.customization,
    message: draft.message,
    // Not validated as a form field — a missing or malformed one is not the
    // customer's mistake to fix. validateOrder drops it to null, and submitOrder
    // then routes the order down the phone path rather than taking a payment it
    // could not make idempotent.
    attemptId: draft.attemptId,
    delivery: {
      type: draft.delivery.type,
      cityId: Number(draft.delivery.cityId) || null,
      officeCode: draft.delivery.officeCode ?? null,
      street: draft.delivery.street,
      streetNum: draft.delivery.streetNum,
      quarter: draft.delivery.quarter,
      floor: draft.delivery.floor,
      apt: draft.delivery.apt,
      note: draft.delivery.note,
      streetIsFreeform: draft.delivery.streetIsFreeform,
    },
  })

  if (hasErrors(errors) || !value) {
    return json({
      ok: false,
      message: 'Моля, проверете данните във формата.',
      errors: errors as Record<string, string>,
    })
  }

  try {
    // Re-resolve against fresh nomenclature: an office the client cached may
    // have closed or been renamed since. Better to ask the customer to pick
    // again than to accept an order addressed to somewhere that no longer exists.
    //
    // But distinguish "Econt says this does not exist" from "Econt did not
    // answer". Only the first is the customer's problem to fix.
    let city: CityDto | null = null
    let office: OfficeDto | null = null

    try {
      city = (await findCity(value.delivery.cityId)) ?? null
      if (!city) {
        return json({
          ok: false,
          message: 'Не разпознахме този град. Изберете го отново от списъка.',
          field: 'city',
        })
      }

      if (value.delivery.type !== 'address') {
        office =
          (await findOffice(city.id, String(value.delivery.officeCode))) ?? null
        if (!office) {
          return json({
            ok: false,
            message:
              value.delivery.type === 'aps'
                ? 'Този автомат вече не е активен. Изберете друг.'
                : 'Този офис вече не е активен. Изберете друг.',
            field: 'officeCode',
          })
        }
      }
    } catch (error) {
      // Econt is down. Accept the order anyway with the destination unverified:
      // the customer chose from a list that was valid when the page loaded, and
      // every order is confirmed by phone regardless. Turning them away because
      // a third party is unavailable loses the sale for nothing.
      logFailure(error)
      city = null
      office = null
    }

    const context: OrderContext = {
      city,
      office,
      rawCityId: value.delivery.cityId,
      rawOfficeCode: value.delivery.officeCode ?? null,
      userAgent: request.headers.get('user-agent'),
    }

    const accepted = await submitOrder(value, context)

    return json({
      ok: true,
      orderRef: accepted.orderRef,
      total: toDto(accepted.total),
      shipping: accepted.shipping ? toDto(accepted.shipping) : null,
      redirectUrl: accepted.redirectUrl,
    })
  } catch (error) {
    logFailure(error)
    return json({
      ok: false,
      // The order did not land, so do not imply it did. This is the one place a
      // customer must be told to try again rather than reassured.
      message:
        'Нещо се обърка при изпращането. Опитайте отново или ни се обадете.',
    })
  }
}

function toDto(money: Money): MoneyDto {
  return { cents: money.cents, currency: money.currency }
}

function json(payload: OrderResponse): NextResponse {
  return NextResponse.json(payload, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}
