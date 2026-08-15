import type { Metadata } from 'next'
import { CtaButton } from '@/components/site/cta-button'
import { CloseIcon } from '@/components/site/icons'
import { OrderOutcome } from '@/components/site/order-outcome'
import { PageShell } from '@/components/site/page-shell'

export const metadata: Metadata = {
  title: 'Плащането не беше завършено — Wondercraft',
  robots: { index: false, follow: false },
}

/**
 * Where myPOS sends the browser when a payment is cancelled or declined.
 *
 * The order row stays at payment_status = 'pending' — we do not cancel it here,
 * because a card page can be abandoned and then completed on a retry. Nothing
 * was charged.
 */
export default function OrderCancelPage() {
  return (
    <PageShell>
      <OrderOutcome
        tone="neutral"
        icon={<CloseIcon className="h-7 w-7 text-charcoal" aria-hidden="true" />}
        title="Плащането не беше завършено"
        lead="Нищо не е таксувано. Може да опитате отново или да ни оставите телефон и ние ще се свържем с вас, за да довършим поръчката."
      >
        <div className="flex flex-col items-center gap-4">
          <CtaButton model="standard">Опитайте отново</CtaButton>
          <a
            href="/"
            className="link-underline text-sm font-medium text-charcoal hover:text-salmon-deep"
          >
            Обратно към началото
          </a>
        </div>
      </OrderOutcome>
    </PageShell>
  )
}
