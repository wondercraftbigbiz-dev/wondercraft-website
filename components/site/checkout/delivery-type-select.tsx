'use client'

import type { DeliveryType } from '@/lib/econt/dto'
import { LockerIcon, PinIcon, StorefrontIcon } from '../icons'

type Option = {
  value: DeliveryType
  label: string
  Icon: (props: { className?: string; 'aria-hidden'?: boolean }) => React.ReactElement
}

const OPTIONS: Option[] = [
  { value: 'office', label: 'Офис', Icon: StorefrontIcon },
  { value: 'aps', label: 'Автомат', Icon: LockerIcon },
  { value: 'address', label: 'Адрес', Icon: PinIcon },
]

/**
 * Where the parcel goes: an Econt office, an automat, or the customer's door.
 *
 * Native radios rather than buttons with roles. They bring arrow-key navigation
 * and group semantics for free, and — the reason it matters here — a radio group
 * exposes exactly one tabbable element, so the dialog's Tab trap counts the same
 * number of stops however many options there are.
 */
export function DeliveryTypeSelect({
  value,
  onChange,
  disabled,
  describedBy,
}: {
  value: DeliveryType
  onChange: (value: DeliveryType) => void
  /** Options that exist but cannot be used, with the reason to show. */
  disabled?: Partial<Record<DeliveryType, string>>
  describedBy?: string
}) {
  const reasons = disabled ?? {}
  const activeReason = reasons[value]

  return (
    <fieldset>
      <legend className="mb-1.5 block font-sans text-sm font-semibold text-charcoal">
        Доставка до
      </legend>

      <div
        className="grid grid-cols-3 gap-2 rounded-md border border-border-soft bg-kraft/25 p-1"
        aria-describedby={describedBy}
      >
        {OPTIONS.map(({ value: option, label, Icon }) => {
          const reason = reasons[option]
          return (
            <div key={option} className="contents">
              <input
                id={`delivery-${option}`}
                type="radio"
                name="deliveryType"
                className="peer sr-only"
                value={option}
                checked={value === option}
                disabled={Boolean(reason)}
                onChange={() => onChange(option)}
              />
              <label
                htmlFor={`delivery-${option}`}
                title={reason}
                className="flex min-h-11 cursor-pointer flex-col items-center justify-center gap-1 rounded-sm px-2 py-2 text-center font-sans text-xs font-semibold text-charcoal-soft transition-colors duration-150 hover:bg-cream peer-checked:bg-salmon peer-checked:text-charcoal peer-checked:shadow-soft peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-salmon-deep peer-disabled:cursor-not-allowed peer-disabled:opacity-45 peer-disabled:hover:bg-transparent"
              >
                <Icon className="h-5 w-5" aria-hidden={true} />
                {label}
              </label>
            </div>
          )
        })}
      </div>

      {activeReason && (
        <p className="mt-1 text-xs text-charcoal-soft">{activeReason}</p>
      )}
    </fieldset>
  )
}
