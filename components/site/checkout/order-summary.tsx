'use client'

import { BGN_PER_EUR, eur, formatMoney, orderTotal, toBgn } from '@/lib/money'

/**
 * The price block: product line, delivery, total.
 *
 * Euro is primary with lev in parentheses, matching the pricing cards, plus the
 * fixed rate — during the changeover a customer checking the arithmetic needs to
 * see it.
 *
 * Delivery is free, so there is no live shipping quote here and the total is
 * simply unit × quantity. The Econt integration still decides *where* the parcel
 * goes; it just no longer decides what it costs. If delivery ever becomes
 * chargeable this grows a shipping row again — and see the warning in
 * supabase/migrations/006_delivery_destination.sql before it does.
 */
export function OrderSummary({
  unitPriceEurCents,
  quantity,
}: {
  unitPriceEurCents: number
  quantity: number
}) {
  const unit = eur(unitPriceEurCents)
  const total = orderTotal(unitPriceEurCents, quantity)

  return (
    <div>
      <dl className="space-y-1">
        <Row
          label={quantity > 1 ? `Къщичка × ${quantity}` : 'Къщичка'}
          value={dual(total)}
          hint={quantity > 1 ? `по ${formatMoney(unit, { trimZeroCents: true })}` : undefined}
        />

        <div className="flex items-baseline justify-between gap-4 text-sm text-charcoal-soft">
          <dt className="font-sans">Доставка</dt>
          <dd className="text-right font-medium text-charcoal">Безплатна</dd>
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
      </p>

      {/* Announced without stealing focus, so a screen-reader user hears the
          total settle instead of discovering it on the way to the button. */}
      <span aria-live="polite" className="sr-only">
        Общо {formatMoney(total)} за {quantity}{' '}
        {quantity === 1 ? 'къщичка' : 'къщички'}, с безплатна доставка.
      </span>
    </div>
  )
}

function Row({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm text-charcoal-soft">
      <dt className="font-sans">
        {label}
        {hint && <span className="ml-1 text-xs">({hint})</span>}
      </dt>
      <dd className="tabular-nums text-charcoal">{value}</dd>
    </div>
  )
}

function dual(money: ReturnType<typeof eur>): string {
  return `${formatMoney(money)} (${formatMoney(toBgn(money))})`
}
