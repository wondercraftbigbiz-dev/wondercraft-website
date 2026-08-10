// Order intake. The browser posts the contact modal here; everything is
// re-validated server-side and prices are looked up from lib/data/pricing.ts,
// never taken from the request.
//
// Persistence goes through the place_order() Postgres function, which upserts
// the customer and inserts the order in a single transaction.
import { NextResponse } from 'next/server'
import { plans } from '@/lib/data/pricing'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
// Order intake must never be served from a cache.
export const dynamic = 'force-dynamic'

const MAX_LEN = {
  name: 120,
  phone: 40,
  email: 254,
  city: 200,
  printName: 60,
  customization: 1000,
  message: 2000,
}

// Deliberately permissive: this catches typos and bots, not exotic-but-valid
// addresses. Real verification happens when we phone the customer.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function fail(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status })
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail('Невалидна заявка.')
  }

  if (typeof body !== 'object' || body === null) {
    return fail('Невалидна заявка.')
  }
  const input = body as Record<string, unknown>

  // Honeypot: a hidden field no human ever fills. Answer as though it worked so
  // the bot has nothing to tune against, but write nothing.
  if (str(input.website, 100) !== '') {
    return NextResponse.json({ ok: true, orderNumber: null })
  }

  const name = str(input.name, MAX_LEN.name)
  const phone = str(input.phone, MAX_LEN.phone)
  const email = str(input.email, MAX_LEN.email).toLowerCase()
  const city = str(input.city, MAX_LEN.city)
  const modelId = str(input.model, 40)

  if (!name) return fail('Моля, въведете име.')
  if (!phone) return fail('Моля, въведете телефон.')
  if (!email) return fail('Моля, въведете имейл.')
  if (!EMAIL_RE.test(email)) return fail('Моля, проверете имейла.')
  if (!city) return fail('Моля, въведете град или офис на куриер.')

  const plan = plans.find((p) => p.id === modelId)
  if (!plan) return fail('Моля, изберете модел.')

  const isCustom = plan.id === 'custom'

  // Misconfigured environment must still surface as a readable message rather
  // than an unhandled throw, or the customer sees a raw 500 page.
  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch (err) {
    console.error('[orders] Supabase client unavailable:', err)
    return fail(
      'Възникна проблем при изпращането. Моля, опитайте отново или се свържете с нас.',
      500,
    )
  }

  const { data, error } = await supabase.rpc('place_order', {
    p_email: email,
    p_full_name: name,
    p_phone: phone,
    p_city: city,
    p_product_id: plan.id,
    p_product_name: plan.name,
    p_unit_price_eur: plan.priceEur,
    p_unit_price_bgn: plan.priceBgn,
    p_quantity: 1,
    // Personalisation only means something for the custom model; drop it
    // otherwise so a stale value can't ride along on a standard order.
    p_print_name: isCustom ? str(input.printName, MAX_LEN.printName) || null : null,
    p_customization: isCustom
      ? str(input.customization, MAX_LEN.customization) || null
      : null,
    p_message: str(input.message, MAX_LEN.message) || null,
    p_marketing_consent: input.marketingConsent === true,
    p_source: 'order_form',
    p_utm: null,
    p_user_agent: request.headers.get('user-agent'),
  })

  if (error) {
    console.error('[orders] place_order failed:', error)
    return fail(
      'Възникна проблем при изпращането. Моля, опитайте отново или се свържете с нас.',
      500,
    )
  }

  const row = Array.isArray(data) ? data[0] : data
  return NextResponse.json({ ok: true, orderNumber: row?.order_number ?? null })
}
