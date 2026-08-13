import { cn } from '@/lib/utils'

/**
 * The card shared by /order/success and /order/cancel. Same corrugated-edge
 * language as the pricing cards so a return from the payment page still feels
 * like the same site.
 */
export function OrderOutcome({
  icon,
  title,
  lead,
  reference,
  children,
  tone = 'positive',
}: {
  icon: React.ReactNode
  title: string
  lead: string
  reference?: string
  children?: React.ReactNode
  tone?: 'positive' | 'neutral'
}) {
  return (
    <main className="px-5 py-14 md:py-24">
      <div className="mx-auto w-full max-w-xl">
        <div className="overflow-hidden rounded-lg border border-border-soft bg-cream shadow-soft-lg">
          <div className="corrugation h-3 w-full bg-kraft" aria-hidden="true" />

          <div className="px-6 py-10 text-center md:px-10">
            <span
              className={cn(
                'mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-border-soft',
                tone === 'positive' ? 'bg-salmon' : 'bg-kraft',
              )}
            >
              {icon}
            </span>

            <h1 className="mt-6 text-balance font-display text-[26px] font-semibold leading-[1.2] tracking-[-0.015em] text-charcoal md:text-3xl">
              {title}
            </h1>

            <p className="mt-4 text-pretty text-base leading-relaxed text-charcoal-soft">
              {lead}
            </p>

            {reference && (
              <p className="mt-5 inline-block rounded-md border border-border-soft bg-kraft/40 px-4 py-2 font-sans text-sm text-charcoal">
                Номер на поръчката:{' '}
                <span className="font-semibold tabular-nums">{reference}</span>
              </p>
            )}

            {children && <div className="mt-8">{children}</div>}
          </div>
        </div>
      </div>
    </main>
  )
}
