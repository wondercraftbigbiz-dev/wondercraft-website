'use client'

import { useState } from 'react'
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js'
import { getStripeClient } from '@/lib/stripe/client'
import { AlertIcon, SpinnerIcon } from '../icons'

/**
 * The payment half of checkout: mounted once `/api/order` has placed the
 * order and returned a PaymentIntent client secret.
 *
 * `redirect: 'if_required'` keeps a card payment on this page — the return
 * URL only matters for the minority of payment methods that must leave the
 * page (e.g. some 3DS challenges). `onSuccess` is the source of truth for the
 * UI; the webhook, not this component, is the source of truth for whether the
 * order is actually marked paid in the database.
 */
export function PaymentStep({
  clientSecret,
  onSuccess,
}: {
  clientSecret: string
  onSuccess: () => void
}) {
  return (
    <Elements stripe={getStripeClient()} options={{ clientSecret, locale: 'bg' }}>
      <PaymentForm onSuccess={onSuccess} />
    </Elements>
  )
}

function PaymentForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePay(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements || submitting) return
    setSubmitting(true)
    setError(null)

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: {
        return_url: `${window.location.origin}/checkout/return`,
      },
    })

    if (confirmError) {
      setError(
        confirmError.message ?? 'Плащането не бе успешно. Опитайте отново.',
      )
      setSubmitting(false)
      return
    }

    if (
      paymentIntent?.status === 'succeeded' ||
      paymentIntent?.status === 'processing'
    ) {
      onSuccess()
      return
    }

    setError('Плащането не бе завършено. Опитайте отново.')
    setSubmitting(false)
  }

  return (
    <form onSubmit={handlePay} className="flex flex-col gap-4">
      <PaymentElement />

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-salmon-deep bg-salmon/25 px-4 py-3 text-sm leading-relaxed text-charcoal"
        >
          <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!stripe || submitting}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-border-soft bg-salmon px-6 py-3 font-sans text-base font-semibold text-charcoal shadow-soft transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-salmon-hover hover:shadow-soft-lg active:scale-[0.96] active:duration-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:scale-100"
      >
        {submitting && (
          <SpinnerIcon className="h-4 w-4 animate-spin" aria-hidden="true" />
        )}
        {submitting ? 'Обработваме плащането…' : 'Плати'}
      </button>
    </form>
  )
}
