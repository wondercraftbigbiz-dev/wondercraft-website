import Link from 'next/link'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const metadata = {
  title: 'Поръчката е получена — Wondercraft',
}

// The order status changes as the webhook lands, so this must never be cached.
export const dynamic = 'force-dynamic'

/**
 * Where Stripe returns the customer.
 *
 * This page READS status and never writes it. Arriving here proves only that a
 * browser followed a redirect — the URL can be visited directly, and for delayed
 * payment methods the money genuinely has not moved yet. The webhook is what
 * marks an order paid, so nothing is fulfilled from here.
 *
 * It also shows nothing sensitive: an order number and a payment state, both
 * looked up server-side. The session id in the URL is a bearer-ish handle, so it
 * buys the reader only what they already knew.
 */
type Status = 'paid' | 'pending' | 'failed' | 'unknown'

async function lookUpStatus(
  sessionId: string | undefined,
): Promise<{ status: Status; orderNumber: number | null }> {
  if (!sessionId) return { status: 'unknown', orderNumber: null }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('orders')
      .select('order_number, payment_status')
      .eq('provider_order_id', sessionId)
      .maybeSingle()

    if (error || !data) return { status: 'unknown', orderNumber: null }

    const orderNumber = Number(data.order_number)
    switch (data.payment_status) {
      case 'paid':
        return { status: 'paid', orderNumber }
      case 'failed':
      case 'cancelled':
        return { status: 'failed', orderNumber }
      default:
        // 'pending' or 'unpaid': the webhook has not settled it yet. Common and
        // not a problem — it usually lands within seconds of the redirect.
        return { status: 'pending', orderNumber }
    }
  } catch {
    // A lookup failure must not turn a completed purchase into an error page.
    return { status: 'unknown', orderNumber: null }
  }
}

const COPY: Record<Status, { title: string; body: string }> = {
  paid: {
    title: 'Благодарим ви за поръчката!',
    body: 'Плащането е потвърдено. Ще се свържем с вас, за да уточним доставката.',
  },
  pending: {
    title: 'Получихме поръчката ви',
    body: 'Потвърждаваме плащането — това отнема момент. Ще се свържем с вас веднага щом приключи.',
  },
  failed: {
    title: 'Плащането не беше завършено',
    body: 'Поръчката е запазена, но плащането не мина. Можете да опитате отново или да ни се обадите.',
  },
  unknown: {
    title: 'Благодарим ви за поръчката!',
    body: 'Ще се свържем с вас възможно най-скоро, за да потвърдим поръчката и доставката.',
  },
}

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>
}) {
  const { ref } = await searchParams
  const { status, orderNumber } = await lookUpStatus(ref)
  const copy = COPY[status]

  return (
    <section className="flex min-h-[70vh] items-center justify-center px-5 py-20">
      <div className="mx-auto max-w-md text-center">
        <span
          className={`mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full border border-border-soft ${
            status === 'pending' ? 'bg-amber' : 'bg-jade-tint'
          }`}
        >
          {status === 'pending' ? (
            // Amber highlights a step still in sequence; jade affirms a done one.
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8 text-charcoal"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8 text-jade-ink"
              aria-hidden="true"
            >
              <path d="M4 12.5l5 5L20 6" />
            </svg>
          )}
        </span>
        <h1 className="mt-6 font-display text-3xl font-bold text-charcoal">
          {copy.title}
        </h1>
        {orderNumber !== null && (
          <p className="mt-3 font-sans text-base text-charcoal">
            Номер на поръчка:{' '}
            <span className="font-semibold tabular-nums">#{orderNumber}</span>
          </p>
        )}
        <p className="mt-4 text-base leading-relaxed text-charcoal-soft">
          {copy.body}
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-md border border-border-soft bg-salmon px-6 py-3 font-sans text-base font-semibold text-charcoal shadow-soft transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5 hover:bg-salmon-hover hover:shadow-soft-lg active:scale-[0.96] active:duration-100"
        >
          Обратно към началото
        </Link>
      </div>
    </section>
  )
}
