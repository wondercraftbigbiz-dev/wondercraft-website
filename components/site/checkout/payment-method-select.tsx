'use client'

import type { PaymentMethod } from '@/lib/payments/dto'
import { BanknoteIcon, CardIcon } from '../icons'

type Option = {
  value: PaymentMethod
  label: string
  note: string
  Icon: (props: { className?: string; 'aria-hidden'?: boolean }) => React.ReactElement
}

const OPTIONS: Option[] = [
  {
    value: 'cod',
    label: 'Наложен платеж',
    note: 'Плащате на куриера при получаване.',
    Icon: BanknoteIcon,
  },
  {
    value: 'card',
    label: 'Плащане с карта',
    note: 'Плащате сега, сигурно, през Stripe.',
    Icon: CardIcon,
  },
]

/**
 * How the customer pays.
 *
 * Same construction as DeliveryTypeSelect, deliberately: native radios for
 * arrow-key navigation and group semantics, one tabbable element for the
 * dialog's Tab trap, and the same `disabled` map carrying a reason to show
 * rather than an option that silently does nothing.
 *
 * Two columns rather than three, and each option carries a one-line note. This
 * is the only choice in the form where the customer is deciding about money
 * rather than logistics, so the trade-off is spelled out instead of implied.
 */
export function PaymentMethodSelect({
  value,
  onChange,
  disabled,
  describedBy,
  error,
}: {
  value: PaymentMethod
  onChange: (value: PaymentMethod) => void
  /** Options that exist but cannot be used, with the reason to show. */
  disabled?: Partial<Record<PaymentMethod, string>>
  describedBy?: string
  error?: string
}) {
  const reasons = disabled ?? {}
  const activeReason = reasons[value]

  return (
    <fieldset>
      <legend className="mb-1.5 block font-sans text-sm font-semibold text-charcoal">
        Начин на плащане
      </legend>

      <div
        className="grid grid-cols-2 gap-2 rounded-md border border-border-soft bg-kraft/25 p-1"
        aria-describedby={describedBy}
      >
        {OPTIONS.map(({ value: option, label, note, Icon }) => {
          const reason = reasons[option]
          return (
            <div key={option} className="contents">
              <input
                id={`payment-${option}`}
                type="radio"
                name="paymentMethod"
                className="peer sr-only"
                value={option}
                checked={value === option}
                disabled={Boolean(reason)}
                onChange={() => onChange(option)}
              />
              <label
                htmlFor={`payment-${option}`}
                title={reason}
                className="flex min-h-11 cursor-pointer flex-col items-center justify-center gap-1 rounded-sm px-2 py-2.5 text-center font-sans text-xs font-semibold text-charcoal-soft transition-colors duration-150 hover:bg-cream peer-checked:bg-salmon peer-checked:text-charcoal peer-checked:shadow-soft peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-salmon-deep peer-disabled:cursor-not-allowed peer-disabled:opacity-45 peer-disabled:hover:bg-transparent"
              >
                <Icon className="h-5 w-5" aria-hidden={true} />
                {label}
                <span className="font-normal text-[11px] leading-snug text-charcoal-soft peer-checked:text-charcoal">
                  {note}
                </span>
              </label>
            </div>
          )
        })}
      </div>

      {activeReason && (
        <p className="mt-1 text-xs text-charcoal-soft">{activeReason}</p>
      )}

      {error && (
        <p role="alert" className="mt-1 text-sm font-medium text-salmon-deep">
          {error}
        </p>
      )}
    </fieldset>
  )
}
