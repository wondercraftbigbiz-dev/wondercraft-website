'use client'

import type { Dispatch } from 'react'
import { VCity } from '@/lib/bg'
import { APS_MAX_PARCEL_HINT, type DeliveryType } from '@/lib/econt/dto'
import { findPlan } from '@/lib/data/pricing'
import { AlertIcon } from '../icons'
import { Field } from '../field'
import { AddressFields } from './address-fields'
import { CityCombobox } from './city-combobox'
import { DeliveryTypeSelect } from './delivery-type-select'
import { OfficePicker } from './office-picker'
import type { Action, OrderState } from './order-reducer'
import { useCities, useCityDetails, useOffices } from './use-econt-data'

/**
 * The delivery half of the order form: where it goes, in Econt's terms.
 *
 * Owns the Econt fetches so the rest of the modal stays unaware of them.
 */
export function DeliverySection({
  state,
  dispatch,
  cityInputRef,
}: {
  state: OrderState
  dispatch: Dispatch<Action>
  cityInputRef?: React.RefObject<HTMLInputElement | null>
}) {
  const { delivery, errors } = state
  const cities = useCities(true)
  const cityId = delivery.city?.id ?? null
  // Only fetch what the current mode needs: offices for pickup, streets and
  // quarters for the door.
  const offices = useOffices(delivery.type === 'address' ? null : cityId)
  const cityDetails = useCityDetails(delivery.type === 'address' ? cityId : null)

  const plan = findPlan(state.planId)
  const parcel = plan?.parcel

  // Grey out the automat when the box cannot physically fit one. The server
  // checks this too — Econt changes locker sizes, so the client's copy of the
  // limits is a fast path, not the rule.
  const tooBigForAps =
    parcel !== undefined &&
    parcel.weightKg > 0 &&
    !fitsInAps(parcel, APS_MAX_PARCEL_HINT)

  const disabledTypes: Partial<Record<DeliveryType, string>> = {}
  if (tooBigForAps) {
    disabledTypes.aps = 'Пратката е твърде голяма за автомат на Еконт.'
  } else if (delivery.city && !delivery.city.hasAps) {
    disabledTypes.aps = `${VCity(delivery.city.name)} няма автомат на Еконт.`
  }
  if (delivery.city && !delivery.city.hasOffice) {
    disabledTypes.office = `${VCity(delivery.city.name)} няма офис на Еконт.`
  }

  return (
    <div className="flex flex-col gap-4">
      <DeliveryTypeSelect
        value={delivery.type}
        disabled={disabledTypes}
        onChange={(value) => dispatch({ type: 'setDeliveryType', value })}
      />

      {state.notice && (
        <p className="rounded-md border border-border-soft bg-sage/60 px-4 py-3 text-sm leading-relaxed text-charcoal">
          {state.notice}
        </p>
      )}

      <Field label="Град" error={errors.city}>
        {({ describedBy, hasError }) => (
          <CityCombobox
            cities={cities}
            value={delivery.city}
            query={delivery.cityQuery}
            deliveryType={delivery.type}
            describedBy={describedBy}
            hasError={hasError}
            inputRef={cityInputRef}
            onQueryChange={(value) =>
              dispatch({ type: 'setDeliveryText', field: 'cityQuery', value })
            }
            onSelect={(city) => dispatch({ type: 'selectCity', city })}
          />
        )}
      </Field>

      {(delivery.type === 'office' || delivery.type === 'aps') &&
        (delivery.city ? (
          <Field
            as="group"
            label={delivery.type === 'aps' ? 'Автомат' : 'Офис'}
            error={errors.officeCode}
          >
            {({ describedBy }) => (
              <OfficePicker
                offices={offices}
                deliveryType={delivery.type as 'office' | 'aps'}
                selectedCode={delivery.officeCode}
                cityName={delivery.city?.name ?? ''}
                describedBy={describedBy}
                onSelect={(code) => dispatch({ type: 'selectOffice', code })}
                onSwitchToAddress={() =>
                  dispatch({ type: 'setDeliveryType', value: 'address' })
                }
              />
            )}
          </Field>
        ) : (
          <p className="text-sm text-charcoal-soft">
            Изберете град, за да видите офисите на Еконт.
          </p>
        ))}

      {delivery.type === 'address' &&
        (delivery.city ? (
          <AddressFields state={state} dispatch={dispatch} details={cityDetails} />
        ) : (
          <p className="text-sm text-charcoal-soft">
            Изберете град, за да въведете адрес.
          </p>
        ))}

      {errors.form && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-salmon-deep bg-salmon/25 px-4 py-3 text-sm leading-relaxed text-charcoal"
        >
          <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          {errors.form}
        </p>
      )}
    </div>
  )
}

/** Sorted-triple comparison, so a box that only fits rotated still counts. */
function fitsInAps(
  parcel: { weightKg: number; lengthCm: number; widthCm: number; heightCm: number },
  limit: typeof APS_MAX_PARCEL_HINT,
): boolean {
  if (parcel.weightKg > limit.weightKg) return false
  const box = [parcel.lengthCm, parcel.widthCm, parcel.heightCm].sort((a, b) => a - b)
  const slot = [limit.lengthCm, limit.widthCm, limit.heightCm].sort((a, b) => a - b)
  return box.every((side, i) => side <= slot[i])
}
