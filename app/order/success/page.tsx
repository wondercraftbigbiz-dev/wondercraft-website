import type { Metadata } from 'next'
import { CheckIcon } from '@/components/site/icons'
import { OrderOutcome } from '@/components/site/order-outcome'
import { PageShell } from '@/components/site/page-shell'

export const metadata: Metadata = {
  title: 'Благодарим за поръчката — Wondercraft',
  robots: { index: false, follow: false },
}

/**
 * Where myPOS sends the browser after a successful payment.
 *
 * IMPORTANT: reaching this page is NOT proof of payment — anyone can open the
 * URL directly. Settlement is confirmed only by the signed server-to-server
 * notification at /api/mypos/notify. The copy below is therefore written to
 * confirm that we received the order, not to assert that money moved.
 */
export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>
}) {
  const { order } = await searchParams
  // Only render a reference that looks like one of ours.
  const reference =
    order && /^WC-[A-Z0-9-]{4,40}$/.test(order) ? order : undefined

  return (
    <PageShell>
      <OrderOutcome
        icon={<CheckIcon className="h-7 w-7 text-charcoal" aria-hidden="true" />}
        title="Благодарим ви за поръчката!"
        lead="Получихме поръчката ви. Веднага след като плащането бъде потвърдено от банката, ще ви изпратим имейл с потвърждение и детайли за доставката."
        reference={reference}
      >
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm leading-relaxed text-charcoal-soft">
            Обработката на плащането отнема до няколко минути. Ако не получите
            имейл до един работен ден, свържете се с нас и ще проверим поръчката.
          </p>
          <a
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-border-soft bg-salmon px-6 py-3 font-sans text-base font-semibold text-charcoal shadow-soft transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-salmon-hover hover:shadow-soft-lg active:scale-[0.96] active:duration-100"
          >
            Обратно към началото
          </a>
        </div>
      </OrderOutcome>
    </PageShell>
  )
}
