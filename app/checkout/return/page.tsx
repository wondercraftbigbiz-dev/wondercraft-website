'use client'

import { useEffect, useState } from 'react'
import { getStripeClient } from '@/lib/stripe/client'

/**
 * Landing page for the rare payment method that must leave the site to
 * confirm (some bank redirects, occasional 3DS challenges). Card payments
 * with `redirect: 'if_required'` never reach this page.
 *
 * This is a UI nicety only — it reads the PaymentIntent status purely to show
 * the customer something sensible. The Stripe webhook, not this page, is the
 * source of truth for whether the order is actually marked paid.
 */
export default function CheckoutReturnPage() {
  const [status, setStatus] = useState<
    'loading' | 'succeeded' | 'processing' | 'failed'
  >('loading')

  useEffect(() => {
    const clientSecret = new URLSearchParams(window.location.search).get(
      'payment_intent_client_secret',
    )
    if (!clientSecret) {
      setStatus('failed')
      return
    }

    getStripeClient().then(async (stripe) => {
      if (!stripe) {
        setStatus('failed')
        return
      }
      const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret)
      if (paymentIntent?.status === 'succeeded') setStatus('succeeded')
      else if (paymentIntent?.status === 'processing') setStatus('processing')
      else setStatus('failed')
    })
  }, [])

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      {status === 'loading' && (
        <p className="text-charcoal-soft">Проверяваме плащането…</p>
      )}
      {status === 'succeeded' && (
        <>
          <h1 className="font-display text-2xl font-bold text-charcoal">
            Благодарим ви!
          </h1>
          <p className="mt-3 text-charcoal-soft">
            Плащането е успешно. Ще се свържем с вас, за да потвърдим поръчката
            и доставката.
          </p>
        </>
      )}
      {status === 'processing' && (
        <>
          <h1 className="font-display text-2xl font-bold text-charcoal">
            Обработваме плащането
          </h1>
          <p className="mt-3 text-charcoal-soft">
            Ще потвърдим поръчката веднага щом плащането приключи — обикновено
            отнема само няколко минути.
          </p>
        </>
      )}
      {status === 'failed' && (
        <>
          <h1 className="font-display text-2xl font-bold text-charcoal">
            Плащането не бе завършено
          </h1>
          <p className="mt-3 text-charcoal-soft">
            Опитайте отново или се свържете с нас, за да завършим поръчката.
          </p>
        </>
      )}
      <a href="/" className="mt-8 text-sm font-semibold text-charcoal underline">
        Обратно към сайта
      </a>
    </main>
  )
}
