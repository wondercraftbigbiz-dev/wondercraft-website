import type { Metadata } from 'next'
import Link from 'next/link'
import { Footer } from '@/components/site/footer'
import { Header } from '@/components/site/header'
import { ModalProvider } from '@/components/site/modal-context'
import { findOrderByProviderId, type OrderSummaryRow } from '@/lib/db/client'
import { logFailure } from '@/lib/econt/route-helpers'
import { eur, formatDual } from '@/lib/money'
import { formatOrderRef } from '@/lib/order/submit-order'

export const metadata: Metadata = {
  title: 'Благодарим за поръчката',
  // Nothing here should ever appear in a search result: the URL identifies a
  // specific customer's order.
  robots: { index: false, follow: false },
}

/** The order state is written by the webhook, so this page can never be cached. */
export const dynamic = 'force-dynamic'

/**
 * Where Stripe returns the customer after paying.
 *
 * Read-only, and deliberately not the thing that marks an order paid — this URL
 * is a redirect anyone could type. The webhook is what settles the order; this
 * page reports what it recorded. So when the webhook has not landed yet (a
 * second or two, occasionally longer), it says the payment is being confirmed
 * rather than inventing a confirmation.
 */
export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { session_id: sessionId } = await searchParams

  let order: OrderSummaryRow | null = null
  if (sessionId) {
    try {
      order = await findOrderByProviderId(sessionId)
    } catch (error) {
      // A lookup failure must not turn a completed payment into an error page.
      logFailure(error)
    }
  }

  const paid = order?.payment_status === 'paid'

  return (
    <ModalProvider>
      <Header />
      <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 py-20 text-center">
        <h1 className="text-balance font-serif text-3xl leading-tight text-charcoal sm:text-4xl">
          {paid ? 'Благодарим за поръчката!' : 'Получихме поръчката ви'}
        </h1>

        <p className="mt-5 text-pretty text-base leading-relaxed text-charcoal-soft">
          {paid
            ? 'Плащането е получено. Изпращаме къщичката с Еконт и ще получите номер за проследяване, щом пратката тръгне.'
            : 'Потвърждаваме плащането в момента. Това отнема няколко секунди — може да затворите страницата, поръчката е записана.'}
        </p>

        {order && (
          <dl className="mt-8 w-full max-w-sm rounded-lg border border-border-soft bg-cream/60 px-6 py-5 text-left">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-charcoal-soft">Номер на поръчката</dt>
              <dd className="font-sans font-semibold tabular-nums text-charcoal">
                {formatOrderRef(order.order_number)}
              </dd>
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-4">
              <dt className="text-sm text-charcoal-soft">Общо</dt>
              <dd className="font-sans font-semibold tabular-nums text-charcoal">
                {/* total_eur arrives as numeric euros; back to cents so the one
                    formatter in lib/money owns the rounding and the dual display. */}
                {formatDual(eur(Math.round(order.total_eur * 100))).both}
              </dd>
            </div>
          </dl>
        )}

        {/* No confirmation email is sent by this site yet, so it is not promised
            here. Stripe's own receipt, if enabled on the account, is the only
            mail the customer gets. */}
        <p className="mt-8 text-sm text-charcoal-soft">
          Запазете номера на поръчката — с него можем да я намерим, ако ни
          потърсите.
        </p>

        <Link
          href="/"
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-md border border-border-soft bg-salmon px-6 py-3 font-sans text-base font-semibold text-charcoal shadow-soft transition-all duration-200 hover:bg-salmon-hover"
        >
          Обратно към сайта
        </Link>
      </main>
      <Footer />
    </ModalProvider>
  )
}
