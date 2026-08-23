'use client'

import type { Dispatch } from 'react'
import { useMemo, useState } from 'react'
import { LIMITS } from '@/lib/order/schema'
import { Field } from '../field'
import { Combobox, type ComboboxItem } from './combobox'
import type { Action, OrderState } from './order-reducer'
import type { Loadable } from './use-econt-data'
import type { QuarterDto, StreetDto } from '@/lib/econt/dto'

/**
 * Door delivery: street, number, and the optional detail a courier needs to
 * actually find the flat.
 *
 * Econt validates streets against its own nomenclature, so a street picked from
 * the list is the reliable path. New builds and villages routinely are not in
 * it, hence the freeform escape hatch — without it those customers simply cannot
 * order.
 */
export function AddressFields({
  state,
  dispatch,
  details,
}: {
  state: OrderState
  dispatch: Dispatch<Action>
  details: Loadable<{ streets: StreetDto[]; quarters: QuarterDto[] }>
}) {
  const { delivery, errors } = state
  const loading = details.status === 'loading'
  const data = details.status === 'ok' ? details.data : { streets: [], quarters: [] }

  const [streetQuery, setStreetQuery] = useState(delivery.street)
  const [quarterQuery, setQuarterQuery] = useState(delivery.quarter)

  const streetItems = useMemo(() => toItems(data.streets), [data.streets])
  const quarterItems = useMemo(() => toItems(data.quarters), [data.quarters])

  // A city Econt has no streets for leaves the customer no choice but freeform,
  // so switch them over rather than showing an empty dropdown.
  const noStreetList = details.status === 'ok' && data.streets.length === 0
  const freeform = delivery.streetIsFreeform || noStreetList

  return (
    <div className="flex flex-col gap-4">
      <Field
        label="Улица"
        error={errors.street}
        hint={
          noStreetList
            ? 'Еконт няма списък с улици за този град — въведете адреса ръчно.'
            : undefined
        }
      >
        {({ describedBy, hasError }) =>
          freeform ? (
            <input
              name="street"
              type="text"
              className="modal-input"
              maxLength={LIMITS.street}
              placeholder="напр. ул. Първа"
              value={delivery.street}
              aria-invalid={hasError || undefined}
              aria-describedby={describedBy}
              onChange={(e) =>
                dispatch({
                  type: 'setDeliveryText',
                  field: 'street',
                  value: e.target.value,
                })
              }
            />
          ) : (
            <Combobox
              name="street"
              items={streetItems}
              value={delivery.street ? delivery.street : null}
              query={streetQuery}
              loading={loading}
              placeholder="Започнете да пишете…"
              emptyMessage="Няма такава улица в списъка на Еконт."
              describedBy={describedBy}
              hasError={hasError}
              onQueryChange={(value) => {
                setStreetQuery(value)
                // Typing invalidates a previously chosen street, so the quote
                // cannot survive on a street that is no longer selected.
                if (delivery.street) {
                  dispatch({ type: 'setDeliveryText', field: 'street', value: '' })
                }
              }}
              onSelect={(item) => {
                setStreetQuery(item?.label ?? '')
                dispatch({
                  type: 'setDeliveryText',
                  field: 'street',
                  value: item?.label ?? '',
                })
              }}
            />
          )
        }
      </Field>

      {!noStreetList && (
        <label className="-my-2 flex min-h-11 items-center gap-2.5 py-2">
          <input
            type="checkbox"
            className="h-5 w-5 shrink-0 accent-salmon-deep"
            checked={delivery.streetIsFreeform}
            onChange={(e) => {
              setStreetQuery('')
              dispatch({ type: 'setStreetFreeform', value: e.target.checked })
            }}
          />
          <span className="font-sans text-sm text-charcoal-soft">
            Улицата не е в списъка
          </span>
        </label>
      )}

      {/* Two-up below sm: three tracks give each field ~96px at 360px and
          ~76px at 320px, which is narrower than the "Апартамент" label above it. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Номер" error={errors.streetNum}>
          {({ describedBy, hasError }) => (
            <input
              name="streetNum"
              type="text"
              inputMode="numeric"
              className="modal-input"
              maxLength={LIMITS.streetNum}
              value={delivery.streetNum}
              aria-invalid={hasError || undefined}
              aria-describedby={describedBy}
              onChange={(e) =>
                dispatch({
                  type: 'setDeliveryText',
                  field: 'streetNum',
                  value: e.target.value,
                })
              }
            />
          )}
        </Field>

        <Field label="Етаж">
          <input
            name="floor"
            type="text"
            inputMode="numeric"
            className="modal-input"
            maxLength={LIMITS.floor}
            value={delivery.floor}
            onChange={(e) =>
              dispatch({ type: 'setDeliveryText', field: 'floor', value: e.target.value })
            }
          />
        </Field>

        <Field label="Апартамент">
          <input
            name="apt"
            type="text"
            className="modal-input"
            maxLength={LIMITS.apt}
            value={delivery.apt}
            onChange={(e) =>
              dispatch({ type: 'setDeliveryText', field: 'apt', value: e.target.value })
            }
          />
        </Field>
      </div>

      {quarterItems.length > 0 && (
        <Field label="Квартал (по избор)">
          {({ describedBy }) => (
            <Combobox
              name="quarter"
              items={quarterItems}
              value={delivery.quarter ? delivery.quarter : null}
              query={quarterQuery}
              loading={loading}
              placeholder="Започнете да пишете…"
              emptyMessage="Няма такъв квартал в списъка на Еконт."
              describedBy={describedBy}
              onQueryChange={(value) => {
                setQuarterQuery(value)
                if (delivery.quarter) {
                  dispatch({ type: 'setDeliveryText', field: 'quarter', value: '' })
                }
              }}
              onSelect={(item) => {
                setQuarterQuery(item?.label ?? '')
                dispatch({
                  type: 'setDeliveryText',
                  field: 'quarter',
                  value: item?.label ?? '',
                })
              }}
            />
          )}
        </Field>
      )}

      <Field label="Бележка за куриера (по избор)">
        <input
          name="note"
          type="text"
          className="modal-input"
          maxLength={LIMITS.note}
          placeholder="напр. вход Б, звънец 12"
          value={delivery.note}
          onChange={(e) =>
            dispatch({ type: 'setDeliveryText', field: 'note', value: e.target.value })
          }
        />
      </Field>
    </div>
  )
}

/** Streets and quarters are identified by name, which is what Econt's label
 * expects — the numeric ids are not accepted on an address. */
function toItems(list: Array<{ id: number; name: string }>): ComboboxItem[] {
  return list.map((item) => ({ key: item.name, label: item.name }))
}
