'use client'

import { useMemo } from 'react'
import type { CityDto, DeliveryType } from '@/lib/econt/dto'
import { Combobox, type ComboboxItem } from './combobox'
import type { Loadable } from './use-econt-data'

/**
 * Settlement picker over Econt's city nomenclature.
 *
 * Rows carry region and post code because Bulgarian settlement names repeat —
 * there are three Калояново, in three different regions — so the label alone
 * cannot identify a choice. Selection is by id throughout; nothing keys on name.
 */
export function CityCombobox({
  cities,
  value,
  query,
  deliveryType,
  onQueryChange,
  onSelect,
  describedBy,
  hasError,
  inputRef,
}: {
  cities: Loadable<CityDto[]>
  value: CityDto | null
  query: string
  /** Cities that cannot serve this type are hidden rather than shown as dead ends. */
  deliveryType: DeliveryType
  onQueryChange: (query: string) => void
  onSelect: (city: CityDto | null) => void
  describedBy?: string
  hasError?: boolean
  inputRef?: React.RefObject<HTMLInputElement | null>
}) {
  const all = cities.status === 'ok' ? cities.data : []

  const items = useMemo(
    () =>
      all
        .filter((city) => servesType(city, deliveryType))
        .map(
          (city): ComboboxItem => ({
            key: String(city.id),
            label: city.name,
            meta: [city.region, city.postCode].filter(Boolean).join(' · '),
            search: city.nameEn,
          }),
        ),
    [all, deliveryType],
  )

  const byId = useMemo(() => new Map(all.map((c) => [String(c.id), c])), [all])

  return (
    <>
      <Combobox
        name="city"
        items={items}
        value={value ? String(value.id) : null}
        query={query}
        loading={cities.status === 'loading'}
        placeholder="Започнете да пишете…"
        emptyMessage={
          deliveryType === 'address'
            ? 'Няма такъв град в списъка на Еконт.'
            : 'Няма град с такова име, което Еконт обслужва.'
        }
        describedBy={describedBy}
        hasError={hasError}
        inputRef={inputRef}
        onQueryChange={onQueryChange}
        onSelect={(item) => onSelect(item ? (byId.get(item.key) ?? null) : null)}
      />

      {cities.status === 'error' && (
        <p className="mt-1 text-xs text-charcoal-soft">{cities.message}</p>
      )}
    </>
  )
}

/**
 * Only hide cities for office and automat delivery. Every settlement can be
 * delivered to by address, so address mode lists them all.
 */
function servesType(city: CityDto, type: DeliveryType): boolean {
  if (type === 'office') return city.hasOffice
  if (type === 'aps') return city.hasAps
  return true
}
