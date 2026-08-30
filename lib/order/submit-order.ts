import 'server-only'

import { findPlan, type Plan } from '@/lib/data/pricing'
import { addMoney, eur, toBgn, toEur, type Money } from '@/lib/money'
import type { CityDto, DeliveryDto, OfficeDto } from '@/lib/econt/dto'
import { logFailure } from '@/lib/econt/route-helpers'
import { calculateShipping } from '@/lib/econt/shipping'
import { getStripe, isStripeConfigured } from '@/lib/stripe/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
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
  /**
   * Client-minted id for one payment attempt, stable across retries within a
   * single open of the form. Used three ways: as the Stripe idempotency key, as
   * the lookup for an already-created session, and stored on the order so a
   * double submit is visible in the data rather than only in Stripe.
   */
  attemptId: string
  userAgent: string | null
}

export type AcceptedOrder = {
  orderRef: string
  /** The database's own sequential reference — what a phone call quotes. */
  orderNumber: number
  plan: Plan
  product: Money
  /** Null when Econt could not price it; we confirm by phone in that case. */
  shipping: Money | null
  total: Money
  quoteId: string | null
  /**
   * Where to send the browser to pay, or null when there is nothing payable
   * yet — no shipping price, so no honest total to charge.
   */
  checkoutUrl: string | null
}

/**
 * Accept an order.
 *
 * The single place an order becomes real. Ordering matters here and is not
 * arbitrary:
 *
 *   price  →  Stripe session  →  place_order  →  redirect
 *
 * The session is created before the row because `provider_order_id` — the key
 * the webhook settles on — *is* the session id. Creating the row first would
 * mean writing it with a null key and updating it afterwards, which opens a
 * window where a paid session has no order to settle against. Doing it this way
 * the only failure window is an orphaned session, and step 4 below closes that
 * by expiring it.
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

  // An order is payable only when the whole amount is known. With no shipping
  // price the total is the product alone, and charging that would quietly make
  // the shop absorb delivery on every order — so fall back to the phone flow
  // rather than open a session for a number we know is wrong.
  const payable = shipping !== null && isStripeConfigured()

  // Reuse before create: a double-click, or a customer who came back and
  // resubmitted, must not produce a second order or a second session.
  if (payable) {
    const existing = await findExistingAttempt(context.attemptId)
    if (existing) return { ...existing, plan, product, shipping, total, quoteId }
  }

  let checkoutUrl: string | null = null
  let sessionId: string | null = null

  if (payable && shipping) {
    const session = await createCheckoutSession({
      plan,
      input,
      product,
      shipping,
      orderRef,
      attemptId: context.attemptId,
    })
    checkoutUrl = session.url
    sessionId = session.id
  }

  let orderNumber: number
  try {
    orderNumber = await persistOrder({
      orderRef,
      input,
      context,
      plan,
      product,
      shipping,
      sessionId,
    })
  } catch (error) {
    // The row did not land. Kill the session so no customer can pay into an
    // order that does not exist — mark_order_paid would return 'not_found' and
    // we would be holding their money with nothing to ship.
    if (sessionId) {
      try {
        await getStripe().checkout.sessions.expire(sessionId)
      } catch (expireError) {
        logFailure(expireError)
      }
    }
    throw error
  }

  await notifyOrder({ orderRef, input, total })

  return {
    orderRef,
    orderNumber,
    plan,
    product,
    shipping,
    total,
    quoteId,
    checkoutUrl,
  }
}

/**
 * An order already written for this attempt, if there is one.
 *
 * Returns its still-open Checkout Session when the payment has not settled, so
 * a resubmit lands the customer back on the same Stripe page. A session that
 * Stripe has since expired or completed yields null for the URL rather than a
 * dead link.
 */
async function findExistingAttempt(
  attemptId: string,
): Promise<Pick<AcceptedOrder, 'orderRef' | 'orderNumber' | 'checkoutUrl'> | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('orders')
    .select('order_number, provider_order_id, payment_status')
    .eq('attempt_id', attemptId)
    .maybeSingle()

  if (error) {
    // A failed lookup must not block the sale; the worst case is a duplicate
    // order, which is visible and fixable. Losing the order is not.
    logFailure(error)
    return null
  }
  if (!data) return null

  let checkoutUrl: string | null = null
  if (data.payment_status === 'pending' && data.provider_order_id) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(
        data.provider_order_id,
      )
      if (session.status === 'open') checkoutUrl = session.url
    } catch (error) {
      logFailure(error)
    }
  }

  return {
    orderRef: `WC-${data.order_number}`,
    orderNumber: Number(data.order_number),
    checkoutUrl,
  }
}

/**
 * Build the Checkout Session.
 *
 * Every amount here is read from the server's own catalogue and the server's own
 * Econt quote. Nothing the browser sent reaches Stripe as a number — that is the
 * whole point of doing this here rather than in the client.
 */
async function createCheckoutSession(args: {
  plan: Plan
  input: OrderInput
  product: Money
  shipping: Money
  orderRef: string
  attemptId: string
}): Promise<{ id: string; url: string | null }> {
  const { plan, input, product, shipping, orderRef, attemptId } = args
  const origin = siteOrigin()

  const session = await getStripe().checkout.sessions.create(
    {
      mode: 'payment',
      locale: 'bg',
      customer_email: input.email,
      client_reference_id: attemptId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: product.cents,
            product_data: {
              name: `Къщичка Wondercraft — ${plan.name}`,
              // No images: a broken absolute URL here fails the whole session.
            },
          },
        },
      ],
      // Delivery as a shipping rate rather than a second line item, so Stripe's
      // receipt breaks it down the same way OrderSummary does on our page.
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            display_name: 'Доставка с Еконт',
            fixed_amount: { amount: shipping.cents, currency: 'eur' },
          },
        },
      ],
      metadata: {
        order_ref: orderRef,
        attempt_id: attemptId,
        plan_id: plan.id,
        sku: plan.sku,
      },
      success_url: `${origin}/order/success?ref={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/order/cancel`,
    },
    // Same key, same session: Stripe collapses a double submit for us.
    { idempotencyKey: `checkout:${attemptId}` },
  )

  return { id: session.id, url: session.url }
}

/**
 * Write the order.
 *
 * Everything goes through place_order rather than an insert: it upserts the
 * customer, records marketing consent, and returns the sequential order_number
 * in one transaction. It is granted to service_role alone, which is why this
 * uses the admin client.
 *
 * Money crosses into the database here, and only here: the columns are numeric
 * euros and leva, the application works in integer cents, so this is the single
 * cents/100 boundary. total_eur and total_bgn are generated columns — do not
 * pass a total, the database computes it from these parts.
 */
async function persistOrder(record: {
  orderRef: string
  input: OrderInput
  context: OrderContext
  plan: Plan
  product: Money
  shipping: Money | null
  sessionId: string | null
}): Promise<number> {
  const { input, context, plan, product, shipping, sessionId } = record

  const { data, error } = await getSupabaseAdmin().rpc('place_order', {
    p_email: input.email,
    p_full_name: input.name,
    p_phone: input.phone,
    p_city: context.city?.name ?? null,

    p_product_id: plan.sku,
    p_product_name: plan.name,
    p_quantity: 1,
    p_unit_price_eur: product.cents / 100,
    p_unit_price_bgn: toBgn(product).cents / 100,
    p_shipping_eur: (shipping?.cents ?? 0) / 100,

    p_print_name: input.printName,
    p_customization: input.customization,
    p_message: input.message,

    p_source: 'website',
    p_user_agent: context.userAgent,

    p_payment_provider: sessionId ? 'stripe' : null,
    p_provider_order_id: sessionId,
    p_attempt_id: context.attemptId,
    // 'pending' means a session is open and we are waiting on the webhook.
    // 'unpaid' is the phone-confirmation path, where nothing was ever charged.
    p_payment_status: sessionId ? 'pending' : 'unpaid',

    p_delivery_type: input.delivery.type,
    p_econt_city_id: context.city?.id ?? context.rawCityId,
    p_econt_city_name: context.city?.name ?? null,
    p_econt_post_code: context.city?.postCode ?? null,
    p_econt_office_code: context.office?.code ?? context.rawOfficeCode,
    p_econt_office_name: context.office?.name ?? null,
    p_street: input.delivery.street ?? null,
    p_street_num: input.delivery.streetNum ?? null,
    p_quarter: input.delivery.quarter ?? null,
    p_floor: input.delivery.floor ?? null,
    p_apt: input.delivery.apt ?? null,
    p_delivery_note: input.delivery.note ?? null,
    // Econt was unreachable, so the destination was accepted unverified. These
    // orders need a careful confirmation call.
    p_econt_unverified: context.city === null,
  })

  if (error) {
    // invalid_email / missing_name / missing_phone (SQLSTATE 22023) are ours,
    // not the customer's: validateOrder already passed, so reaching them means
    // this mapping drifted from the validator.
    logFailure(error)
    throw new Error(`place_order failed: ${error.message}`)
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row?.order_number) throw new Error('place_order returned no order_number')

  return Number(row.order_number)
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
 * Stripe will not take a relative success_url, and getting this wrong sends
 * paying customers to the wrong host, so fail with a name rather than build a
 * broken URL.
 */
function siteOrigin(): string {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim()
  if (configured) return configured.replace(/\/+$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  throw new Error(
    'NEXT_PUBLIC_SITE_URL is not set; cannot build Stripe return URLs.',
  )
}

/**
 * A short, human-quotable reference: WC-<base36 time><random>.
 *
 * Time-prefixed so references sort chronologically, and short enough to read
 * back over the phone without asking anyone to spell a UUID. Note this is the
 * pre-insert reference used in Stripe metadata; once the row exists the
 * database's own order_number is the better handle, and it is what the success
 * page shows.
 */
function makeOrderRef(): string {
  const time = Date.now().toString(36).toUpperCase()
  const rand = Math.floor(Math.random() * 36 ** 3)
    .toString(36)
    .toUpperCase()
    .padStart(3, '0')
  return `WC-${time}${rand}`
}
