'use client'

import { MAX_QUANTITY } from '@/lib/data/pricing'
import { PlusMinusIcon } from './icons'

/**
 * Quantity control for the checkout.
 *
 * Reuses PlusMinusIcon from the FAQ accordion: isOpen collapses the vertical
 * stroke, so isOpen={true} draws a minus and isOpen={false} draws a plus.
 */
export function QuantityStepper({
  value,
  onChange,
  disabled = false,
  min = 1,
  max = MAX_QUANTITY,
  labelId,
}: {
  value: number
  onChange: (next: number) => void
  disabled?: boolean
  min?: number
  max?: number
  labelId?: string
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next))

  const buttonClass =
    'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border-soft bg-cream text-charcoal transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:bg-kraft/60 active:scale-[0.94] active:duration-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-cream'

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        aria-label="Намали количеството"
        className={buttonClass}
      >
        <PlusMinusIcon isOpen className="h-4 w-4" />
      </button>

      {/* The live value is the accessible source of truth for the count. */}
      <output
        aria-labelledby={labelId}
        aria-live="polite"
        className="min-w-10 text-center font-display text-xl font-semibold tabular-nums text-charcoal"
      >
        {value}
      </output>

      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || value >= max}
        aria-label="Увеличи количеството"
        className={buttonClass}
      >
        <PlusMinusIcon isOpen={false} className="h-4 w-4" />
      </button>
    </div>
  )
}
