'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, MapPin } from 'lucide-react'
import type { City, Office } from '@/lib/econt/types'

export type EcontSelection = {
  city: City
  office: Office
}

export function EcontPicker({
  value,
  onChange,
  error,
}: {
  value: EcontSelection | null
  onChange: (selection: EcontSelection | null) => void
  error?: string
}) {
  const [cities, setCities] = useState<City[]>([])
  const [citiesError, setCitiesError] = useState(false)
  const [loadingCities, setLoadingCities] = useState(true)

  const [city, setCity] = useState<City | null>(value?.city ?? null)
  const [offices, setOffices] = useState<Office[]>([])
  const [officesError, setOfficesError] = useState(false)
  const [loadingOffices, setLoadingOffices] = useState(false)

  // --- cities -------------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    setLoadingCities(true)
    fetch('/api/econt/cities')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { cities: City[] }) => {
        if (cancelled) return
        setCities(data.cities ?? [])
        setCitiesError(false)
      })
      .catch(() => {
        if (!cancelled) setCitiesError(true)
      })
      .finally(() => {
        if (!cancelled) setLoadingCities(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // --- offices for the chosen city ---------------------------------------
  useEffect(() => {
    if (!city) {
      setOffices([])
      return
    }
    let cancelled = false
    setLoadingOffices(true)
    setOfficesError(false)
    fetch(`/api/econt/offices?cityId=${city.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { offices: Office[] }) => {
        if (cancelled) return
        setOffices(data.offices ?? [])
      })
      .catch(() => {
        if (!cancelled) setOfficesError(true)
      })
      .finally(() => {
        if (!cancelled) setLoadingOffices(false)
      })
    return () => {
      cancelled = true
    }
  }, [city])

  function handleCityChange(next: City | null) {
    setCity(next)
    // Changing city invalidates any chosen office.
    onChange(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <Combobox
        label="Град"
        placeholder={loadingCities ? 'Зареждане…' : 'Търсете град…'}
        disabled={loadingCities || citiesError}
        items={cities}
        selected={city}
        onSelect={handleCityChange}
        getKey={(c) => c.id}
        getLabel={(c) => c.name}
        getSecondary={(c) => c.regionName}
        // Bulgarian users type Latin as often as Cyrillic, so match both.
        matches={(c, q) =>
          c.name.toLowerCase().includes(q) ||
          c.nameEn.toLowerCase().includes(q) ||
          c.postCode.includes(q)
        }
        emptyText="Няма намерен град."
      />

      {citiesError && (
        <Notice>
          Списъкът с градове не можа да бъде зареден. Опитайте да презаредите
          страницата.
        </Notice>
      )}

      <div>
        <span className="mb-1.5 block font-display text-sm font-semibold text-charcoal">
          Офис на Еконт
        </span>

        {!city ? (
          <p className="rounded-[8px] border-2 border-dashed border-charcoal/30 px-3 py-3 text-sm text-charcoal-soft">
            Първо изберете град.
          </p>
        ) : loadingOffices ? (
          <OfficeSkeleton />
        ) : officesError ? (
          <Notice>Офисите не можаха да бъдат заредени. Опитайте отново.</Notice>
        ) : offices.length === 0 ? (
          <Notice>В този град няма офиси на Еконт. Изберете друг град.</Notice>
        ) : (
          <ul
            className="flex max-h-56 flex-col gap-2 overflow-y-auto rounded-[8px] border-2 border-charcoal bg-kraft/30 p-2"
            role="radiogroup"
            aria-label="Офис на Еконт"
          >
            {offices.map((office) => {
              const isSelected = value?.office.id === office.id
              return (
                <li key={office.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => onChange({ city, office })}
                    className={`flex w-full items-start gap-3 rounded-[8px] border-2 border-charcoal px-3 py-2.5 text-left transition-colors ${
                      isSelected
                        ? 'bg-salmon'
                        : 'bg-cream hover:bg-kraft/60'
                    }`}
                  >
                    <span className="mt-0.5 shrink-0">
                      {isSelected ? (
                        <Check className="h-4 w-4 text-charcoal" aria-hidden="true" />
                      ) : (
                        <MapPin
                          className="h-4 w-4 text-charcoal-soft"
                          aria-hidden="true"
                        />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-display text-sm font-semibold text-charcoal">
                        {office.name}
                      </span>
                      {office.address && (
                        <span className="mt-0.5 block text-sm leading-snug text-charcoal-soft">
                          {office.address}
                        </span>
                      )}
                      {office.workingHours && (
                        <span className="mt-0.5 block text-xs text-charcoal-soft">
                          Работно време: {office.workingHours}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {error && (
          <span className="mt-1 block text-sm font-medium text-salmon">{error}</span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// A searchable combobox. Written by hand rather than pulled in as a dependency:
// ~1,500 cities is far too many for a native <select>, but the behaviour needed
// here is small — filter, arrow keys, Enter, Escape.
// ---------------------------------------------------------------------------

function Combobox<T>({
  label,
  placeholder,
  disabled,
  items,
  selected,
  onSelect,
  getKey,
  getLabel,
  getSecondary,
  matches,
  emptyText,
}: {
  label: string
  placeholder: string
  disabled?: boolean
  items: T[]
  selected: T | null
  onSelect: (item: T | null) => void
  getKey: (item: T) => string | number
  getLabel: (item: T) => string
  getSecondary?: (item: T) => string
  matches: (item: T, query: string) => boolean
  emptyText: string
}) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const inputId = `${label}-combobox`

  // Debounce filtering — typing through a 1,500-item list re-renders otherwise.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim().toLowerCase()), 200)
    return () => clearTimeout(t)
  }, [query])

  const filtered = useMemo(() => {
    if (!debounced) return items.slice(0, 50)
    return items.filter((item) => matches(item, debounced)).slice(0, 50)
  }, [items, debounced, matches])

  useEffect(() => setActiveIndex(0), [debounced])

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  // Escape while the dropdown is open must dismiss only the dropdown.
  //
  // The surrounding modal listens for Escape on `document`, but React attaches
  // synthetic handlers to the root container — which is BELOW document — so
  // stopPropagation() from an onKeyDown prop runs too late to stop it, and the
  // whole dialog closes along with everything the user typed. A capture-phase
  // listener on document runs before the modal's bubble-phase one, so this is
  // the only layer that can intercept it.
  useEffect(() => {
    if (!open) return
    function onKeyDownCapture(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
    }
    document.addEventListener('keydown', onKeyDownCapture, true)
    return () => document.removeEventListener('keydown', onKeyDownCapture, true)
  }, [open])

  // Keep the active option in view.
  useEffect(() => {
    if (!open) return
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  function choose(item: T) {
    onSelect(item)
    setQuery('')
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      const delta = e.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((i) => {
        if (filtered.length === 0) return 0
        return (i + delta + filtered.length) % filtered.length
      })
      return
    }
    if (e.key === 'Enter' && open) {
      // Only swallow Enter when it is selecting an option, so the key still
      // submits the surrounding form when the list is closed.
      const item = filtered[activeIndex]
      if (item) {
        e.preventDefault()
        choose(item)
      }
      return
    }
    // Escape is handled by the capture-phase listener below, not here.
  }

  return (
    <div ref={containerRef} className="relative">
      <label
        htmlFor={inputId}
        className="mb-1.5 block font-display text-sm font-semibold text-charcoal"
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${inputId}-list`}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          className="modal-input pr-10"
          placeholder={selected ? getLabel(selected) : placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-soft"
          aria-hidden="true"
        />
      </div>

      {selected && !open && (
        <p className="mt-1.5 text-sm text-charcoal-soft">
          Избран град:{' '}
          <span className="font-semibold text-charcoal">{getLabel(selected)}</span>
        </p>
      )}

      {open && !disabled && (
        <ul
          ref={listRef}
          id={`${inputId}-list`}
          role="listbox"
          className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-[8px] border-2 border-charcoal bg-cream shadow-[4px_4px_0_0_var(--color-charcoal)]"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-charcoal-soft">{emptyText}</li>
          ) : (
            filtered.map((item, index) => {
              const isActive = index === activeIndex
              return (
                <li key={getKey(item)} data-index={index}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(item)}
                    className={`flex w-full items-baseline justify-between gap-3 px-3 py-2.5 text-left text-sm ${
                      isActive ? 'bg-kraft' : 'bg-transparent'
                    }`}
                  >
                    <span className="font-medium text-charcoal">
                      {getLabel(item)}
                    </span>
                    {getSecondary && (
                      <span className="shrink-0 text-xs text-charcoal-soft">
                        {getSecondary(item)}
                      </span>
                    )}
                  </button>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}

function OfficeSkeleton() {
  return (
    <div
      className="flex flex-col gap-2 rounded-[8px] border-2 border-charcoal bg-kraft/30 p-2"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Зареждане на офисите…</span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-[8px] border-2 border-charcoal/20 bg-cream"
          aria-hidden="true"
        />
      ))}
    </div>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[8px] border-2 border-charcoal/30 bg-kraft/40 px-3 py-2.5 text-sm text-charcoal-soft">
      {children}
    </p>
  )
}
