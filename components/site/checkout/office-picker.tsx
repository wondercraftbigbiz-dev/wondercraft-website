'use client'

import { useMemo, useState } from 'react'
import { VCity } from '@/lib/bg'
import type { DeliveryType, OfficeDto } from '@/lib/econt/dto'
import { ClockIcon, CloseIcon, LockerIcon, SearchIcon, StorefrontIcon } from '../icons'
import type { Loadable } from './use-econt-data'

const FILTER_THRESHOLD = 8

/**
 * Pick a specific Econt office or automat within the chosen city.
 *
 * Once something is selected the list collapses to a summary card: a long list
 * of radio cards left open pushes the order total off a phone screen, and the
 * customer has no further use for the alternatives.
 */
export function OfficePicker({
  offices,
  deliveryType,
  selectedCode,
  cityName,
  onSelect,
  onSwitchToAddress,
  describedBy,
}: {
  offices: Loadable<OfficeDto[]>
  deliveryType: Extract<DeliveryType, 'office' | 'aps'>
  selectedCode: string | null
  cityName: string
  onSelect: (code: string) => void
  onSwitchToAddress: () => void
  describedBy?: string
}) {
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState(false)


  const wantAps = deliveryType === 'aps'
  const Icon = wantAps ? LockerIcon : StorefrontIcon
  const noun = wantAps ? 'автомат' : 'офис'

  const available = useMemo(
    () => (offices.status === 'ok' ? offices.data.filter((o) => o.isAps === wantAps) : []),
    [offices, wantAps],
  )

  const selected = available.find((o) => o.code === selectedCode) ?? null

  const shown = useMemo(() => {
    const q = filter.toLocaleLowerCase('bg').trim()
    if (!q) return available
    return available.filter((o) =>
      `${o.name} ${o.address}`.toLocaleLowerCase('bg').includes(q),
    )
  }, [available, filter])

  if (offices.status === 'loading') {
    return <OfficeSkeleton />
  }

  if (offices.status === 'error') {
    return <p className="text-sm text-charcoal-soft">{offices.message}</p>
  }

  if (available.length === 0) {
    return (
      <div className="rounded-md border border-border-soft bg-sage/60 px-4 py-3">
        <p className="text-sm leading-relaxed text-charcoal">
          {cityName ? VCity(cityName) : 'В избрания град'} няма {noun} на Еконт.
        </p>
        <button
          type="button"
          onClick={onSwitchToAddress}
          className="-mb-2 mt-1 inline-flex min-h-11 items-center rounded-sm font-sans text-sm font-semibold text-charcoal underline decoration-salmon-deep decoration-2 underline-offset-4"
        >
          Избери доставка до адрес
        </button>
      </div>
    )
  }

  // Collapsed: show what was chosen, with a way back to the list.
  if (selected && !expanded) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-border-soft-strong bg-kraft/30 p-4 shadow-soft">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-salmon-deep" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-sans text-sm font-semibold text-charcoal">
            {selected.name}
          </p>
          <p className="mt-0.5 text-sm leading-relaxed text-charcoal-soft">
            {selected.address}
          </p>
          {selected.hours && (
            <p className="mt-1 flex items-center gap-1 text-xs text-charcoal-soft">
              <ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {selected.hours}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="-my-2 ml-auto inline-flex min-h-11 shrink-0 items-center rounded-sm px-2 font-sans text-sm font-semibold text-charcoal underline decoration-salmon-deep decoration-2 underline-offset-4 hover:text-charcoal-soft"
        >
          Промени
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {available.length > FILTER_THRESHOLD && (
        <div className="relative">
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-soft"
            aria-hidden="true"
          />
          <input
            type="text"
            className="modal-input pl-9 pr-10"
            enterKeyHint="search"
            placeholder={`Търсене на ${noun}…`}
            value={filter}
            autoCapitalize="off"
            autoCorrect="off"
            aria-label={`Търсене на ${noun}`}
            onChange={(e) => setFilter(e.target.value)}
            // preventDefault marks the Escape as handled, so clearing the
            // search does not also close the modal.
            onKeyDown={(e) => {
              if (e.key === 'Escape' && filter) {
                e.preventDefault()
                setFilter('')
              }
            }}
          />
          {/* Escape clears the box, which is no help without a hardware
              keyboard. */}
          {filter && (
            <button
              type="button"
              aria-label="Изчисти търсенето"
              onClick={() => setFilter('')}
              className="absolute right-0 top-0 inline-flex h-11 w-10 items-center justify-center rounded-md text-charcoal-soft active:bg-charcoal/5"
            >
              <CloseIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      <div
        role="radiogroup"
        aria-label={wantAps ? 'Автомат на Еконт' : 'Офис на Еконт'}
        aria-describedby={describedBy}
        className="max-h-[min(18rem,42dvh)] space-y-2 overflow-y-auto overscroll-contain"
      >
        {shown.length === 0 && (
          <p className="px-1 py-4 text-center text-sm text-charcoal-soft">
            Няма {noun} с това име или адрес.
          </p>
        )}

        {shown.map((office) => (
          <div key={office.code}>
            <input
              id={`office-${office.code}`}
              type="radio"
              name="officeCode"
              className="peer sr-only"
              value={office.code}
              checked={office.code === selectedCode}
              onChange={() => {
                onSelect(office.code)
                setExpanded(false)
              }}
            />
            <label
              htmlFor={`office-${office.code}`}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border-soft bg-cream p-3 transition-colors duration-150 hover:border-border-soft-strong peer-checked:border-border-soft-strong peer-checked:bg-kraft/30 peer-checked:shadow-soft peer-checked:[&>svg]:text-salmon-deep peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-salmon-deep"
            >
              <Icon
                className="mt-0.5 h-5 w-5 shrink-0 text-charcoal-soft"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-sans text-sm font-semibold text-charcoal">
                  {office.name}
                </span>
                <span className="mt-0.5 block text-sm leading-relaxed text-charcoal-soft">
                  {office.address}
                </span>
                {office.hours && (
                  <span className="mt-1 block text-xs text-charcoal-soft">
                    {office.hours}
                  </span>
                )}
              </span>
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Placeholder rows while offices load.
 *
 * The text matters more than the pulse: globals.css clamps animation-duration
 * under prefers-reduced-motion, so animate-pulse is frozen for those users.
 */
function OfficeSkeleton() {
  return (
    <div className="space-y-2" aria-live="polite">
      <span className="sr-only">Зареждаме офисите на Еконт…</span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-md border border-border-soft bg-cream p-3"
          aria-hidden="true"
        >
          <div className="mt-0.5 h-5 w-5 shrink-0 animate-pulse rounded-sm bg-border-soft" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 animate-pulse rounded-sm bg-border-soft" />
            <div className="h-3 w-48 animate-pulse rounded-sm bg-border-soft" />
          </div>
        </div>
      ))}
      <p className="text-center text-xs text-charcoal-soft">Зареждаме офисите…</p>
    </div>
  )
}
