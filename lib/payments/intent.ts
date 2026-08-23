import 'server-only'

import { eur, type Money } from '@/lib/money'
import { attachIntent, findByAttemptId, placeOrder } from '@/lib/order/repository'
import type { OrderInput } from '@/lib/order/schema'
import { orderRefOf, priceOrder, type OrderContext } from '@/lib/order/submit-order'
import { PaymentError } from './errors'
import { buildIntentMetadata } from './metadata'
import { getStripe } from './stripe'

export type IntentResult =
  | {
      kind: 'ok'
      clientSecret: string
      orderRef: string
      total: Money
      shipping: Money
    }
  | { kind: 'repriced'; total: Money; shipping: Money }

/**
 * Price an order, record it, and open a Stripe PaymentIntent for it.
 *
 * The card counterpart to submitOrder(). Both price through priceOrder() and
 * both persist through lib/order/repository.ts; they differ only in what they do
 * about a missing delivery quote and in whether money moves.
 *
 * Ordering matters here and is not incidental:
 *
 *   1. price          — server-side, from the plan id and a fresh Econt quote
 *   2. compare        — against what the customer was shown, never to set it
 *   3. insert the row — BEFORE Stripe is called
 *   4. create intent  — idempotent on attemptId
 *   5. attach the id  — the row is now findable by the webhook
 *
 * Step 3 before step 4 is the whole design. The failure that cannot be recovered
 * from is money taken with no record of what it was for; this inverts it, so the
 * worst case is an unpaid orphan row that nobody was charged for and that is
 * free to sweep.
 */
export async function createIntent(
  input: OrderInput,
  context: OrderContext,
  opts: {
    attemptId: string
    expectedTotalCents: number
    userAgent: string | null
  },
): Promise<IntentResult> {
  const priced = await priceOrder(input, context)

  // Unlike /api/order, this route cannot shrug off an unreachable Econt. That
  // route accepts an unpriced order because the shop confirms every sale by
  // phone; here there is no amount to charge, so there is nothing to confirm.
  // Do not "harmonise" the two — see the note in app/api/order/route.ts.
  if (!priced.shipping) {
    throw new PaymentError('no_quote', 'No delivery quote, cannot charge a card')
  }

  // The customer is looking at a number. If the server now computes a different
  // one, say so and let them agree to it — never silently charge the new total.
  if (priced.total.cents !== opts.expectedTotalCents) {
    return { kind: 'repriced', total: priced.total, shipping: priced.shipping }
  }

  const stripe = getStripe()

  // A duplicate submit must not open a second order. The row is the record of
  // the attempt, so it is also the idempotency check.
  const existing = await findByAttemptId(opts.attemptId)
  if (existing?.providerOrderId) {
    const intent = await stripe.paymentIntents.retrieve(existing.providerOrderId)
    if (intent.client_secret) {
      return {
        kind: 'ok',
        clientSecret: intent.client_secret,
        orderRef: orderRefOf(existing.orderNumber),
        total: priced.total,
        shipping: priced.shipping,
      }
    }
  }

  // Reuse the row from an earlier attempt that never got as far as an intent,
  // rather than inserting a second one for the same payment.
  let orderNumber = existing?.orderNumber ?? null
  if (orderNumber === null) {
    const placed = await placeOrder({
      input,
      context,
      product: priced.product,
      shipping: priced.shipping,
      provider: 'stripe',
      providerOrderId: null,
      attemptId: opts.attemptId,
      paymentStatus: 'pending',
      userAgent: opts.userAgent,
      productName: priced.plan.name,
      unitPriceBgn: bgnMirror(priced.plan.lev),
    })
    orderNumber = placed?.orderNumber ?? null
  }

  if (orderNumber === null) {
    // No row means no record of what the money was for, so do not take any.
    // This is the one place persistence failure DOES refuse the sale: the COD
    // path can fall back to a log line and a phone call, a card charge cannot.
    throw new PaymentError('upstream', 'Could not record the order before charging')
  }

  const orderRef = orderRefOf(orderNumber)

  const intent = await stripe.paymentIntents.create(
    {
      amount: priced.total.cents,
      currency: 'eur',
      // Explicit rather than automatic_payment_methods: this keeps redirect-only
      // wallets off the element, so `redirect: 'if_required'` keeps the customer
      // inside the modal through 3DS instead of bouncing them to a return URL.
      payment_method_types: ['card'],
      description: `${priced.plan.name} (${priced.plan.sku}) ${orderRef}`,
      // ASCII only; Cyrillic is rejected by Stripe.
      statement_descriptor_suffix: 'WONDERCRAFT',
      receipt_email: input.email,
      metadata: buildIntentMetadata({
        orderRef,
        attemptId: opts.attemptId,
        planId: input.planId,
        sku: priced.plan.sku,
        quoteId: priced.quoteId,
        cityId: context.city?.id ?? context.rawCityId,
        deliveryType: input.delivery.type,
        officeCode: context.office?.code ?? context.rawOfficeCode ?? null,
        productEurCents: priced.product.cents,
        shippingEurCents: priced.shipping.cents,
      }),
    },
    // Derived from attemptId, NOT from orderRef: orderRef is issued per call, so
    // an orderRef-keyed request would be unique every time and protect nothing.
    { idempotencyKey: `intent:${opts.attemptId}` },
  )

  if (!intent.client_secret) {
    throw new PaymentError('upstream', 'Stripe returned an intent with no client secret')
  }

  await attachIntent(opts.attemptId, intent.id)

  return {
    kind: 'ok',
    clientSecret: intent.client_secret,
    orderRef,
    total: eur(intent.amount),
    shipping: priced.shipping,
  }
}

/** "58,67 лв." -> 58.67, for the numeric mirror column. */
function bgnMirror(lev: string): number {
  return Number(lev.replace(/[^\d,]/g, '').replace(',', '.'))
}
