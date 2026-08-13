'use client'

import { BGN_PER_EUR, eur, formatMoney, toBgn } from '@/lib/money'
import type { MoneyDto } from '@/lib/econt/dto'
import { SpinnerIcon } from '../icons'
import type { QuoteState } from './order-reducer'

/**
 * The price block in the modal footer: product, delivery, total.
 *
 * Euro is primary with lev in parentheses, matching the pricing cards, plus the
 * fixed rate — during the changeover a customer checking the arithmetic needs to
 * see it.
 */
export function OrderSummary({
  productEurCents,
  quote,
}: {
  productEurCents: number
  quote: QuoteState
}) {
  const product = eur(productEurCents)
  const total = quote.status === 'ok' ? fromDto(quote.total) : product

  return (
    <div>
      <dl className="space-y-1">
        <Row label="Къщичка" value={dual(product)} />

        <div className="flex items-baseline justify-between gap-4 text-sm text-charcoal-soft">
          <dt className="font-sans">Доставка</dt>
          <dd className="text-right">
            {quote.status === 'idle' && (
              <span className="text-charcoal-soft">
                Изберете къде да я доставим
              </span>
            )}

            {quote.status === 'loading' && (
              <span className="inline-flex items-center gap-2">
                <SpinnerIcon
                  className="h-4 w-4 animate-spin text-charcoal-soft"
                  aria-hidden="true"
                />
                {/* The visible label is not decoration: globals.css clamps
                    animation-duration under prefers-reduced-motion, so the
                    spinner is frozen for those users. */}
                Изчисляваме…
              </span>
            )}

            {quote.status === 'ok' && (
              <span className="tabular-nums text-charcoal">
                {dual(fromDto(quote.shipping))}
              </span>
            )}

            {quote.status === 'error' && (
              <span className="text-charcoal">по договаряне</span>
            )}
          </dd>
        </div>

        <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-border-soft pt-3">
          <dt className="font-sans text-base font-semibold text-charcoal">Общо</dt>
          <dd className="text-right">
            <span className="font-display text-2xl font-bold tabular-nums text-charcoal">
              {formatMoney(total)}
            </span>
            <span className="ml-2 font-sans text-sm font-normal text-charcoal-soft">
              ({formatMoney(toBgn(total))})
            </span>
          </dd>
        </div>
      </dl>

      <p className="mt-1 text-right text-xs text-charcoal-soft">
        1 € = {BGN_PER_EUR.toFixed(5).replace('.', ',')} лв.
        {quote.status !== 'ok' && ' · без доставка'}
      </p>

      {/* Announced without stealing focus, so a screen-reader user hears the
          price settle instead of discovering it on the way to the button. */}
      <span aria-live="polite" className="sr-only">
        {quote.status === 'loading' && 'Изчисляваме цената за доставка…'}
        {quote.status === 'ok' &&
          `Доставка ${formatMoney(fromDto(quote.shipping))}. Общо ${formatMoney(total)}.`}
        {quote.status === 'error' && quote.message}
      </span>

      {quote.status === 'error' && (
        <p className="mt-2 text-xs leading-relaxed text-charcoal-soft">
          {quote.message}
        </p>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm text-charcoal-soft">
      <dt className="font-sans">{label}</dt>
      <dd className="tabular-nums text-charcoal">{value}</dd>
    </div>
  )
}

function dual(money: ReturnType<typeof eur>): string {
  return `${formatMoney(money)} (${formatMoney(toBgn(money))})`
}

function fromDto(dto: MoneyDto) {
  return { cents: dto.cents, currency: dto.currency }
}
