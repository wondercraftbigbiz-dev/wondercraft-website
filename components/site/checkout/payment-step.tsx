'use client'

import { type Dispatch } from 'react'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js'
import { formatMoney, toBgn, type Money } from '@/lib/money'
import { AlertIcon, SpinnerIcon } from '../icons'
import type { Action, OrderState } from './order-reducer'
import { stripeAppearance } from './stripe-appearance'

/**
 * Stripe.js, loaded lazily and at most once.
 *
 * Called only when the payment step is actually reached, so a cash-on-delivery
 * customer never fetches js.stripe.com and the homepage never touches it. The
 * module-level promise is the memo; loadStripe itself is not idempotent.
 */
let stripeJs: Promise<Stripe | null> | null = null
function getStripeJs(): Promise<Stripe | null> | null {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  if (!key) return null
  stripeJs ??= loadStripe(key)
  return stripeJs
}

export function PaymentStep({
  state,
  dispatch,
  onPaid,
}: {
  state: OrderState
  dispatch: Dispatch<Action>
  onPaid: (orderRef: string) => void
}) {
  const pay = state.pay

  if (pay.status === 'creating' || pay.status === 'idle') {
    return (
      <p className="flex items-center gap-2 text-sm text-charcoal-soft">
        <SpinnerIcon className="h-4 w-4 animate-spin" aria-hidden="true" />
        Подготвяме плащането…
      </p>
    )
  }

  if (pay.status === 'error') {
    return (
      <p
        role="alert"
        className="flex items-start gap-2 rounded-md border border-salmon-deep bg-salmon/25 px-4 py-3 text-sm leading-relaxed text-charcoal"
      >
        <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        {pay.message}
      </p>
    )
  }

  const stripePromise = getStripeJs()
  if (!stripePromise) return null

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: pay.clientSecret,
        appearance: stripeAppearance,
        // Bulgarian field labels and Bulgarian decline messages, for free.
        locale: 'bg',
      }}
    >
      <CardForm state={state} dispatch={dispatch} onPaid={onPaid} />
    </Elements>
  )
}

function CardForm({
  state,
  dispatch,
  onPaid,
}: {
  state: OrderState
  dispatch: Dispatch<Action>
  onPaid: (orderRef: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const pay = state.pay

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!stripe || !elements) return
    if (pay.status !== 'ready') return

    dispatch({ type: 'payConfirming' })

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/plateno` },
      // Keeps the customer inside the modal, including through the 3DS
      // challenge, which Stripe renders as its own overlay. The redirect branch
      // is a genuine fallback rather than the common path, because the intent is
      // created with payment_method_types: ['card'] and so cannot surface a
      // redirect-only wallet.
      redirect: 'if_required',
    })

    if (error) {
      // A declined card is not a broken payment. Stay on the same intent so
      // another card can be tried without opening a second one.
      if (error.type === 'card_error' || error.type === 'validation_error') {
        dispatch({
          type: 'payDeclined',
          message: error.message ?? 'Картата беше отказана. Опитайте с друга карта.',
        })
        return
      }

      if (error.type === 'api_connection_error') {
        // The payment may well have succeeded. Never say it failed: the webhook
        // is authoritative and the order reference is already known.
        dispatch({
          type: 'payError',
          retryable: false,
          message:
            'Връзката прекъсна и не можем да потвърдим плащането. Не плащайте повторно — ще проверим и ще се свържем с вас.',
        })
        return
      }

      dispatch({
        type: 'payError',
        retryable: true,
        message: error.message ?? 'Плащането не премина. Опитайте отново.',
      })
      return
    }

    if (paymentIntent?.status === 'succeeded') {
      onPaid(pay.status === 'ready' ? pay.orderRef : '')
      return
    }

    if (paymentIntent?.status === 'processing') {
      // Rare for cards, normal for some local methods. The webhook will settle
      // it; tell the truth rather than guessing either way.
      onPaid(pay.status === 'ready' ? pay.orderRef : '')
      return
    }

    dispatch({
      type: 'payError',
      retryable: true,
      message: 'Плащането не беше потвърдено. Опитайте отново.',
    })
  }

  const declineMessage = pay.status === 'ready' ? pay.lastError : null

  return (
    <form id="payment-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* The submit button lives in the modal's aside, outside this subtree, and
          reaches this form through form="payment-form" — the same mechanism the
          details form already uses to span the CSS layout split. */}
      <PaymentElement
        options={{
          layout: 'tabs',
          // The name is already on the order; asking for it again inside the
          // card fields is a second source of truth and one more thing to type.
          fields: { billingDetails: { name: 'never', email: 'never' } },
        }}
      />

      {declineMessage && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-salmon-deep bg-salmon/25 px-4 py-3 text-sm leading-relaxed text-charcoal"
        >
          <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          {declineMessage}
        </p>
      )}

      {pay.status === 'confirming' && (
        <p className="flex items-center gap-2 text-sm text-charcoal-soft">
          <SpinnerIcon className="h-4 w-4 animate-spin" aria-hidden="true" />
          Потвърждаваме плащането. Не затваряйте прозореца.
        </p>
      )}
    </form>
  )
}

/** The amount on the button, so the number pressed is the number charged. */
export function payButtonLabel(total: Money): string {
  return `Плати ${formatMoney(total)} (${formatMoney(toBgn(total))})`
}
