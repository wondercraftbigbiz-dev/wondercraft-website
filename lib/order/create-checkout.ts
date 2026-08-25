import 'server-only'

import type { Plan } from '@/lib/data/pricing'
import type { Money } from '@/lib/money'
import { getStripe, siteUrl } from '@/lib/stripe/client'

/**
 * Create the hosted Checkout Session the customer is redirected to.
 *
 * Every amount here is read from the server's own pricing — plan.priceEurCents
 * and the Econt quote this request just computed. The browser never sends a
 * price, and the session total must equal the order's total_eur, or
 * mark_order_paid() will refuse to settle it and flag payment_mismatch instead.
 */
export async function createCheckoutSession(args: {
  plan: Plan
  product: Money
  /** The Econt quote. Required — we never send someone to pay an unknown total. */
  shipping: Money
  email: string
  attemptId: string
}): Promise<{ id: string; url: string }> {
  const { plan, product, shipping, attemptId } = args

  const session = await getStripe().checkout.sessions.create(
    {
      mode: 'payment',
      locale: 'bg',
      customer_email: args.email,
      // Visible in the Stripe Dashboard, and stored as orders.attempt_id, so a
      // payment can be matched to its order from either side. The order row
      // itself is keyed on the session id below.
      client_reference_id: attemptId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: product.cents,
            product_data: { name: plan.name, description: plan.tagline },
          },
        },
      ],
      // Delivery as a shipping rate rather than a second line item, so Checkout
      // shows it under its own heading and the total reads the way the order
      // summary in the modal did.
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            display_name: 'Доставка с Еконт',
            fixed_amount: { amount: shipping.cents, currency: 'eur' },
          },
        },
      ],
      metadata: { planId: plan.id, attemptId },
      payment_intent_data: { metadata: { planId: plan.id, attemptId } },
      // The session id, not our order number: the order row is written after
      // this call, and the success page looks it up by session id anyway — which
      // also means the page reports what the webhook recorded, not what the
      // redirect claims.
      success_url: `${siteUrl()}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/?canceled=1`,
    },
    // Two clicks on the same submit must not create two sessions — and so must
    // not create two orders. The attempt id is minted once per submit attempt
    // and is the same key place_order() uses.
    { idempotencyKey: `checkout:${attemptId}` },
  )

  if (!session.url) {
    throw new Error(`Stripe session ${session.id} has no redirect URL`)
  }
  return { id: session.id, url: session.url }
}
