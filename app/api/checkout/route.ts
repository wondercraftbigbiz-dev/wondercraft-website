import { randomBytes } from 'node:crypto'
import { splitName, validateCheckout } from '@/lib/checkout/validate'
import { eurToBgn, getPlan, orderTotalEur } from '@/lib/data/pricing'
import { isMyposConfigured } from '@/lib/mypos/config'
import { buildPurchaseRequest } from '@/lib/mypos/purchase'
import { fieldsToRecord } from '@/lib/mypos/sign'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/admin'

/**
 * Starts a checkout.
 *
 * Two modes on the same form:
 *   mode: 'pay'     — records a pending order and returns the signed myPOS
 *                     fields for the browser to POST to the hosted card page.
 *   mode: 'contact' — records an enquiry order; we call the customer back.
 *
 * The amount is always computed here from lib/data/pricing. Nothing the browser
 * sends about price is read, and mark_order_paid re-checks the settled amount
 * against what we stored.
 */

// node:crypto and the service-role client require the Node runtime.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RATE_WINDOW_MS = 10 * 60 * 1000
/**
 * Two tiers, because rejected requests are cheap and accepted ones are not.
 *
 * A shopper who mistypes their email a few times must not lock themselves out,
 * so validation failures only count against the loose ceiling. The tight limit
 * guards the expensive path — writing an order row and signing a purchase.
 */
const REQUEST_LIMIT = 60
const ORDER_LIMIT = 10

/** Short, unambiguous, URL-safe reference sent to myPOS as OrderID. */
function generateOrderReference(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no look-alikes
  const bytes = randomBytes(8)
  let suffix = ''
  for (const byte of bytes) suffix += alphabet[byte % alphabet.length]
  return `WC-${Date.now().toString(36).toUpperCase()}-${suffix}`
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

export async function POST(request: Request): Promise<Response> {
  const ip = clientIp(request)

  if (!rateLimit(`checkout:req:${ip}`, REQUEST_LIMIT, RATE_WINDOW_MS).allowed) {
    return json(
      { ok: false, error: 'rate_limited', message: 'Твърде много заявки. Опитайте отново по-късно.' },
      429,
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400)
  }

  const { input, errors } = validateCheckout(body)
  if (Object.keys(errors).length > 0) {
    return json({ ok: false, error: 'validation', errors }, 400)
  }

  const plan = getPlan(input.planId)
  if (!plan) {
    return json({ ok: false, error: 'validation', errors: { planId: 'Моля, изберете модел.' } }, 400)
  }

  // Past validation, so this request is about to cost us a row.
  if (!rateLimit(`checkout:order:${ip}`, ORDER_LIMIT, RATE_WINDOW_MS).allowed) {
    return json(
      { ok: false, error: 'rate_limited', message: 'Твърде много поръчки. Опитайте отново по-късно.' },
      429,
    )
  }

  if (!isSupabaseConfigured()) {
    console.error('[checkout] Supabase is not configured; cannot record orders.')
    return json({ ok: false, error: 'unavailable' }, 503)
  }

  const wantsPayment = input.mode === 'pay'
  if (wantsPayment && !isMyposConfigured()) {
    // The UI hides the card button in this case; this is the defensive path.
    return json({ ok: false, error: 'payment_unavailable' }, 503)
  }

  const totalEur = orderTotalEur(plan, input.quantity)
  const reference = wantsPayment ? generateOrderReference() : null

  // Build and sign BEFORE writing the order, so a signing failure does not
  // leave an orphaned pending row behind.
  let purchase: { action: string; fields: Record<string, string> } | null = null
  if (wantsPayment && reference) {
    const { firstNames, familyName } = splitName(input.name)
    try {
      const built = buildPurchaseRequest({
        orderId: reference,
        items: [
          {
            article: `${plan.name} — картонена къщичка Wondercraft`,
            quantity: input.quantity,
            priceEur: plan.priceEur,
          },
        ],
        customer: {
          email: input.email,
          phone: input.phone,
          firstNames,
          familyName,
          city: input.city,
        },
        note: `Wondercraft ${reference}`,
      })
      purchase = { action: built.action, fields: fieldsToRecord(built.fields) }
    } catch (cause) {
      console.error('[checkout] failed to build myPOS purchase', cause)
      return json({ ok: false, error: 'payment_unavailable' }, 503)
    }
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .rpc('place_order', {
      p_email: input.email,
      p_full_name: input.name,
      p_phone: input.phone,
      p_city: input.city,
      p_product_id: plan.id,
      p_product_name: plan.name,
      p_unit_price_eur: plan.priceEur,
      p_unit_price_bgn: eurToBgn(plan.priceEur),
      p_quantity: input.quantity,
      p_print_name: input.printName ?? null,
      p_customization: input.customization ?? null,
      p_message: input.message ?? null,
      p_marketing_consent: input.marketingConsent,
      p_source: 'website',
      p_utm: null,
      p_user_agent: request.headers.get('user-agent'),
      p_payment_provider: wantsPayment ? 'mypos' : null,
      p_mypos_order_id: reference,
      p_payment_status: wantsPayment ? 'pending' : 'unpaid',
    })
    .single<{ order_id: string; order_number: number; customer_id: string }>()

  if (error || !data) {
    // place_order raises these for data it will not accept.
    const message = error?.message ?? ''
    if (message.includes('invalid_email')) {
      return json({ ok: false, error: 'validation', errors: { email: 'Моля, проверете имейл адреса.' } }, 400)
    }
    if (message.includes('missing_name')) {
      return json({ ok: false, error: 'validation', errors: { name: 'Моля, въведете име.' } }, 400)
    }
    if (message.includes('missing_phone')) {
      return json({ ok: false, error: 'validation', errors: { phone: 'Моля, въведете телефон.' } }, 400)
    }

    console.error('[checkout] place_order failed', error)
    return json({ ok: false, error: 'server_error' }, 500)
  }

  if (!wantsPayment) {
    return json({ ok: true, mode: 'contact', orderNumber: data.order_number })
  }

  return json({
    ok: true,
    mode: 'pay',
    orderNumber: data.order_number,
    reference,
    totalEur,
    action: purchase!.action,
    fields: purchase!.fields,
  })
}
