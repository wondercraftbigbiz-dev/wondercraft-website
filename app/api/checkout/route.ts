import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { findPlan } from '@/lib/data/pricing'
import type { CityDto, MoneyDto, OfficeDto, OrderResponse } from '@/lib/econt/dto'
import { isDeliveryType } from '@/lib/econt/dto'
import { findCity, findOffice } from '@/lib/econt/nomenclatures'
import { logFailure, rateLimitGuard } from '@/lib/econt/route-helpers'
import { orderTotal, toBgn, type Money } from '@/lib/money'
import { isMyposConfigured } from '@/lib/mypos/config'
import { buildPurchaseRequest } from '@/lib/mypos/purchase'
import { fieldsToRecord } from '@/lib/mypos/sign'
import {
  hasErrors,
  isCheckoutMode,
  validateOrder,
  type OrderDraft,
  type OrderInput,
} from '@/lib/order/schema'
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/server'

/**
 * Place an order — the single order intake for the site.
 *
 * Two finishes on one form:
 *   mode 'pay'     — records the order as `pending` and returns the signed myPOS
 *                    fields for the browser to POST to the hosted card page.
 *   mode 'contact' — records the order as `unpaid`; we phone the customer.
 *
 * Everything the browser sent is re-validated and re-priced here. That is not
 * belt-and-braces: the browser is where a customer's data is typed, not where it
 * is trusted. The amount comes from lib/data/pricing via orderTotal(), and
 * mark_order_paid re-checks the settled amount against the figure stored on the
 * row, so a tampered client cannot buy a house for a cent.
 *
 * Delivery is free, so the total is product × quantity and there is no shipping
 * term. Econt is used to resolve *where* the parcel goes, not what it costs.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 8 * 1024

export async function POST(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return json(
      { ok: false, message: 'Заявката е прекалено голяма.' },
      413,
    )
  }

  let draft: OrderDraft
  try {
    draft = (await request.json()) as OrderDraft
  } catch {
    return json({ ok: false, message: 'Невалидна заявка.' }, 400)
  }

  if (!draft?.delivery || !isDeliveryType(draft.delivery.type)) {
    return json({ ok: false, message: 'Невалидна заявка.' }, 400)
  }

  // Honeypot: a hidden field no human fills in. Answer as though it worked so a
  // bot has nothing to tune against, but write nothing.
  if (String((draft as { website?: unknown }).website ?? '').trim() !== '') {
    return json({
      ok: true,
      orderRef: 'WC-000000000',
      total: { cents: 0, currency: 'EUR' },
      shipping: null,
      orderNumber: null,
    })
  }

  // The same validator the browser ran, so a bypassed client gets the same
  // messages rather than a divergent second set.
  const { errors, value } = validateOrder({
    name: String(draft.name ?? ''),
    phone: String(draft.phone ?? ''),
    email: String(draft.email ?? ''),
    planId: String(draft.planId ?? ''),
    quantity: Number(draft.quantity ?? 1),
    printName: draft.printName,
    customization: draft.customization,
    message: draft.message,
    acceptTerms: draft.acceptTerms === true,
    marketingConsent: draft.marketingConsent === true,
    mode: isCheckoutMode(draft.mode) ? draft.mode : 'contact',
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
    // Validation failures are cheap and a customer may make several while
    // typing, so they are deliberately NOT counted against the order limit.
    return json({
      ok: false,
      message: 'Моля, проверете данните във формата.',
      errors: errors as Record<string, string>,
    })
  }

  // Past validation: this request is about to cost us a row, so rate-limit here
  // rather than at the top.
  const limited = rateLimitGuard(request, 'order')
  if (limited) return limited

  if (!isSupabaseConfigured()) {
    console.error('[checkout] Supabase is not configured; cannot record orders.')
    return json({
      ok: false,
      message: 'Нещо се обърка при изпращането. Опитайте отново или ни се обадете.',
    })
  }

  const wantsPayment = value.mode === 'pay'
  if (wantsPayment && !isMyposConfigured()) {
    // The UI hides the card button in this case; this is the defensive path.
    return json({
      ok: false,
      message:
        'Плащането с карта е временно недостъпно. Изберете „Свържете се с мен“ и ще довършим поръчката заедно.',
    })
  }

  const plan = findPlan(value.planId)
  if (!plan) return json({ ok: false, message: 'Моля, изберете модел.', field: 'model' })

  const total = orderTotal(plan.priceEurCents, value.quantity)

  try {
    const destination = await resolveDestination(value)
    if ('response' in destination) return destination.response

    const { city, office } = destination
    const orderRef = makeOrderRef()

    // Build and sign BEFORE writing the row, so a signing failure cannot leave
    // an orphaned pending order behind.
    let payment: { action: string; fields: Record<string, string> } | undefined
    if (wantsPayment) {
      const { firstNames, familyName } = splitName(value.name)
      const built = buildPurchaseRequest({
        orderId: orderRef,
        items: [
          {
            article: `${plan.name} — картонена къщичка Wondercraft`,
            quantity: value.quantity,
            priceEur: plan.priceEurCents / 100,
          },
        ],
        customer: {
          email: value.email,
          phone: value.phone,
          firstNames,
          familyName,
          city: city?.name ?? '',
          zipCode: city?.postCode ?? '',
        },
        note: `Wondercraft ${orderRef}`,
      })
      payment = { action: built.action, fields: fieldsToRecord(built.fields) }
    }

    const orderNumber = await persistOrder({
      value,
      plan,
      total,
      orderRef,
      city,
      office,
      wantsPayment,
      userAgent: request.headers.get('user-agent'),
    })

    return json({
      ok: true,
      orderRef,
      orderNumber,
      total: toDto(total),
      // Free delivery: there is no shipping amount to report.
      shipping: null,
      payment,
    })
  } catch (error) {
    logFailure(error)
    return json({
      ok: false,
      // The order did not land, so do not imply it did. This is the one place a
      // customer must be told to try again rather than reassured.
      message: 'Нещо се обърка при изпращането. Опитайте отново или ни се обадете.',
    })
  }
}

/**
 * Re-resolve the destination against fresh nomenclature: an office the client
 * cached may have closed or been renamed since the page loaded.
 *
 * Distinguishes "Econt says this does not exist" from "Econt did not answer".
 * Only the first is the customer's problem to fix — if Econt is down we accept
 * the order with the destination unverified, because they chose from a list that
 * was valid when the page loaded and every order is confirmed by phone anyway.
 */
async function resolveDestination(
  value: OrderInput,
): Promise<{ city: CityDto | null; office: OfficeDto | null } | { response: NextResponse }> {
  try {
    const city = (await findCity(value.delivery.cityId)) ?? null
    if (!city) {
      return {
        response: json({
          ok: false,
          message: 'Не разпознахме този град. Изберете го отново от списъка.',
          field: 'city',
        }),
      }
    }

    if (value.delivery.type === 'address') return { city, office: null }

    const office =
      (await findOffice(city.id, String(value.delivery.officeCode))) ?? null
    if (!office) {
      return {
        response: json({
          ok: false,
          message:
            value.delivery.type === 'aps'
              ? 'Този автомат вече не е активен. Изберете друг.'
              : 'Този офис вече не е активен. Изберете друг.',
          field: 'officeCode',
        }),
      }
    }

    return { city, office }
  } catch (error) {
    logFailure(error)
    return { city: null, office: null }
  }
}

async function persistOrder(args: {
  value: OrderInput
  plan: NonNullable<ReturnType<typeof findPlan>>
  total: Money
  orderRef: string
  city: CityDto | null
  office: OfficeDto | null
  wantsPayment: boolean
  userAgent: string | null
}): Promise<number | null> {
  const { value, plan, orderRef, city, office, wantsPayment, userAgent } = args
  const d = value.delivery
  const unitEur = plan.priceEurCents / 100
  const unitBgn = toBgn({ cents: plan.priceEurCents, currency: 'EUR' }).cents / 100

  const { data, error } = await getSupabaseAdmin()
    .rpc('place_order', {
      p_email: value.email,
      p_full_name: value.name,
      p_phone: value.phone,
      // Human-readable summary, so the admin view stays legible alongside the
      // structured Econt columns below.
      p_city: describeDestination(city, office, value),
      p_product_id: plan.id,
      p_product_name: plan.name,
      p_unit_price_eur: unitEur,
      p_unit_price_bgn: unitBgn,
      p_quantity: value.quantity,
      p_print_name: value.printName,
      p_customization: value.customization,
      p_message: value.message,
      p_marketing_consent: value.marketingConsent,
      p_source: 'website',
      p_utm: null,
      p_user_agent: userAgent,
      p_payment_provider: wantsPayment ? 'mypos' : null,
      p_mypos_order_id: wantsPayment ? orderRef : null,
      p_payment_status: wantsPayment ? 'pending' : 'unpaid',
      p_delivery_type: d.type,
      p_econt_city_id: d.cityId,
      p_econt_city_name: city?.name ?? null,
      p_econt_post_code: city?.postCode ?? null,
      p_econt_office_code: office?.code ?? d.officeCode ?? null,
      p_econt_office_name: office?.name ?? null,
      p_street: d.street ?? null,
      p_street_num: d.streetNum ?? null,
      p_quarter: d.quarter ?? null,
      p_floor: d.floor ?? null,
      p_apt: d.apt ?? null,
      p_delivery_note: d.note ?? null,
      // True when Econt was unreachable, so the destination is unverified and
      // the phone call needs to be a careful one.
      p_econt_unverified: city === null,
    })
    .single<{ order_id: string; order_number: number; customer_id: string }>()

  if (error) throw error
  return data?.order_number ?? null
}

/** A one-line destination for the admin list. */
function describeDestination(
  city: CityDto | null,
  office: OfficeDto | null,
  value: OrderInput,
): string {
  const cityName = city?.name ?? `град #${value.delivery.cityId}`
  const d = value.delivery

  if (d.type === 'address') {
    const parts = [d.street, d.streetNum, d.quarter].filter(
      (p) => (p ?? '').trim().length > 0,
    )
    return `${cityName}, ${parts.join(' ')}`.trim()
  }

  const label = d.type === 'aps' ? 'автомат' : 'офис'
  const which = office?.name ?? d.officeCode ?? '?'
  return `${cityName}, ${label} ${which}`
}

/**
 * Split a full name into the first/family parts myPOS asks for. Bulgarian names
 * are usually "Име Презиме Фамилия", so everything before the last token is
 * treated as given names.
 */
function splitName(fullName: string): { firstNames: string; familyName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstNames: '', familyName: '' }
  if (parts.length === 1) return { firstNames: parts[0], familyName: parts[0] }
  return {
    firstNames: parts.slice(0, -1).join(' '),
    familyName: parts[parts.length - 1],
  }
}

/**
 * A short, human-quotable reference: WC-<base36 time><random>.
 *
 * Time-prefixed so references sort chronologically, and short enough to read
 * back over the phone without asking anyone to spell a UUID. Also the myPOS
 * OrderID and the payment idempotency key, so it must be unique — the
 * orders_mypos_order_id_key index enforces that.
 */
function makeOrderRef(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no look-alikes
  let suffix = ''
  for (const byte of randomBytes(4)) suffix += alphabet[byte % alphabet.length]
  return `WC-${Date.now().toString(36).toUpperCase()}${suffix}`
}

function toDto(money: Money): MoneyDto {
  return { cents: money.cents, currency: money.currency }
}

function json(payload: OrderResponse, status = 200): NextResponse {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}
