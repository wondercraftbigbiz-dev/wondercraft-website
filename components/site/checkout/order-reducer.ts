import { VCity } from '@/lib/bg'
import type { CityDto, DeliveryType, MoneyDto } from '@/lib/econt/dto'
import type { PlanId } from '@/lib/data/pricing'
import { MAX_QUANTITY } from '@/lib/data/pricing'
import type {
  CheckoutMode,
  OrderDraft,
  OrderErrorField,
  OrderErrors,
} from '@/lib/order/schema'

/**
 * All checkout state in one reducer.
 *
 * A reducer rather than a dozen useState calls because the invalidation rules
 * are cross-field: choosing a city has to clear the office, changing anything
 * about the destination has to discard the price, and switching delivery type
 * has to drop the other mode's fields. As effects those become a pile of
 * interacting useEffects; as transitions they are single obvious cases below.
 */
export type QuoteState =
  | { status: 'idle' }
  | { status: 'loading' }
  | {
      status: 'ok'
      product: MoneyDto
      shipping: MoneyDto
      total: MoneyDto
      quoteId: string
    }
  | { status: 'error'; message: string }

export type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting'; mode: CheckoutMode }
  /**
   * Card path only: the order is recorded and the browser is being handed to the
   * myPOS page. Terminal from this component's point of view — a full navigation
   * follows, so nothing should re-enable the form.
   */
  | { status: 'redirecting' }
  | { status: 'done'; orderRef: string }
  | { status: 'error'; message: string }

export type DeliveryState = {
  type: DeliveryType
  city: CityDto | null
  /** What is typed in the city box, which may not yet be a chosen city. */
  cityQuery: string
  officeCode: string | null
  street: string
  streetNum: string
  quarter: string
  floor: string
  apt: string
  note: string
  streetIsFreeform: boolean
}

export type OrderState = {
  name: string
  phone: string
  email: string
  planId: PlanId
  quantity: number
  printName: string
  customization: string
  message: string
  acceptTerms: boolean
  marketingConsent: boolean
  delivery: DeliveryState
  errors: OrderErrors
  /** Non-blocking guidance, e.g. "no office in this city, use an address". */
  notice: string | null
  quote: QuoteState
  submit: SubmitState
}

export type TextField =
  | 'name'
  | 'phone'
  | 'email'
  | 'printName'
  | 'customization'
  | 'message'

export type CheckboxField = 'acceptTerms' | 'marketingConsent'

export type DeliveryTextField =
  | 'cityQuery'
  | 'street'
  | 'streetNum'
  | 'quarter'
  | 'floor'
  | 'apt'
  | 'note'

export type Action =
  | { type: 'setText'; field: TextField; value: string }
  | { type: 'setDeliveryText'; field: DeliveryTextField; value: string }
  | { type: 'setPlan'; planId: PlanId }
  | { type: 'setQuantity'; value: number }
  | { type: 'setCheckbox'; field: CheckboxField; value: boolean }
  | { type: 'setDeliveryType'; value: DeliveryType }
  | { type: 'selectCity'; city: CityDto | null }
  | { type: 'selectOffice'; code: string | null }
  | { type: 'setStreetFreeform'; value: boolean }
  | { type: 'clearError'; field: OrderErrorField }
  | { type: 'setErrors'; errors: OrderErrors }
  | { type: 'quoteStart' }
  | {
      type: 'quoteOk'
      product: MoneyDto
      shipping: MoneyDto
      total: MoneyDto
      quoteId: string
    }
  | { type: 'quoteError'; message: string }
  | { type: 'submitStart'; mode: CheckoutMode }
  | { type: 'submitRedirecting' }
  | { type: 'submitOk'; orderRef: string }
  | { type: 'submitError'; message: string }

const IDLE_QUOTE: QuoteState = { status: 'idle' }

export function initialOrderState(planId: PlanId): OrderState {
  return {
    name: '',
    phone: '',
    email: '',
    planId,
    quantity: 1,
    printName: '',
    customization: '',
    message: '',
    acceptTerms: false,
    marketingConsent: false,
    delivery: {
      type: 'office',
      city: null,
      cityQuery: '',
      officeCode: null,
      street: '',
      streetNum: '',
      quarter: '',
      floor: '',
      apt: '',
      note: '',
      streetIsFreeform: false,
    },
    errors: {},
    notice: null,
    quote: IDLE_QUOTE,
    submit: { status: 'idle' },
  }
}

export function orderReducer(state: OrderState, action: Action): OrderState {
  switch (action.type) {
    case 'setText':
      return {
        ...state,
        [action.field]: action.value,
        errors: without(state.errors, action.field),
      }

    case 'setPlan':
      // Weight can differ per plan, so the price is no longer trustworthy.
      return {
        ...state,
        planId: action.planId,
        quote: IDLE_QUOTE,
        errors: without(state.errors, 'model'),
      }

    case 'setDeliveryText': {
      const delivery = { ...state.delivery, [action.field]: action.value }
      // Typing in the city box means the previously chosen city no longer
      // matches what is on screen; drop it so nothing stale can be submitted.
      if (action.field === 'cityQuery') {
        delivery.city = null
        delivery.officeCode = null
      }
      return {
        ...state,
        delivery,
        quote: pricingRelevant(action.field) ? IDLE_QUOTE : state.quote,
        errors: without(state.errors, deliveryErrorField(action.field)),
      }
    }

    case 'setDeliveryType': {
      if (action.value === state.delivery.type) return state
      const delivery: DeliveryState = { ...state.delivery, type: action.value }

      // Drop whatever belonged to the mode we just left.
      if (action.value === 'address') {
        delivery.officeCode = null
      } else {
        delivery.street = ''
        delivery.streetNum = ''
        delivery.quarter = ''
        delivery.floor = ''
        delivery.apt = ''
        delivery.note = ''
        delivery.streetIsFreeform = false
        // An office code is specific to office-vs-automat, so never carry it over.
        delivery.officeCode = null
      }

      return {
        ...state,
        delivery,
        quote: IDLE_QUOTE,
        notice: null,
        errors: without(
          state.errors,
          'deliveryType',
          'officeCode',
          'street',
          'streetNum',
        ),
      }
    }

    case 'selectCity': {
      const city = action.city
      const delivery: DeliveryState = {
        ...state.delivery,
        city,
        cityQuery: city ? city.name : '',
        // Offices, streets and quarters are all per city.
        officeCode: null,
        street: '',
        streetNum: '',
        quarter: '',
        streetIsFreeform: false,
      }

      let notice: string | null = null

      // If the chosen city cannot serve the current delivery type, move the
      // customer somewhere that works instead of showing them an empty list.
      if (city) {
        if (delivery.type === 'office' && !city.hasOffice) {
          if (city.hasAps) {
            delivery.type = 'aps'
            notice = `${VCity(city.name)} няма офис на Еконт, но има автомат.`
          } else {
            delivery.type = 'address'
            notice = `${VCity(city.name)} няма офис на Еконт — избрахме доставка до адрес.`
          }
        } else if (delivery.type === 'aps' && !city.hasAps) {
          if (city.hasOffice) {
            delivery.type = 'office'
            notice = `${VCity(city.name)} няма автомат на Еконт, но има офис.`
          } else {
            delivery.type = 'address'
            notice = `${VCity(city.name)} няма автомат на Еконт — избрахме доставка до адрес.`
          }
        }
      }

      return {
        ...state,
        delivery,
        notice,
        quote: IDLE_QUOTE,
        errors: without(state.errors, 'city', 'officeCode', 'street', 'streetNum'),
      }
    }

    case 'selectOffice':
      return {
        ...state,
        delivery: { ...state.delivery, officeCode: action.code },
        quote: IDLE_QUOTE,
        errors: without(state.errors, 'officeCode'),
      }

    case 'setStreetFreeform':
      return {
        ...state,
        delivery: {
          ...state.delivery,
          streetIsFreeform: action.value,
          street: '',
        },
        quote: IDLE_QUOTE,
        errors: without(state.errors, 'street'),
      }

    case 'clearError':
      return { ...state, errors: without(state.errors, action.field) }

    case 'setErrors':
      return { ...state, errors: action.errors }

    case 'quoteStart':
      return { ...state, quote: { status: 'loading' } }

    case 'quoteOk':
      return {
        ...state,
        quote: {
          status: 'ok',
          product: action.product,
          shipping: action.shipping,
          total: action.total,
          quoteId: action.quoteId,
        },
      }

    case 'quoteError':
      return { ...state, quote: { status: 'error', message: action.message } }

    case 'setQuantity': {
      const value = Math.min(MAX_QUANTITY, Math.max(1, Math.trunc(action.value)))
      if (value === state.quantity) return state
      // Quantity changes the parcel, so any delivery price is stale. Harmless
      // while delivery is free, but keeps the invariant honest if it stops being.
      return {
        ...state,
        quantity: value,
        quote: IDLE_QUOTE,
        errors: without(state.errors, 'quantity'),
      }
    }

    case 'setCheckbox':
      return {
        ...state,
        [action.field]: action.value,
        // Only the terms box can carry an error; marketing consent is optional.
        errors:
          action.field === 'acceptTerms'
            ? without(state.errors, 'acceptTerms')
            : state.errors,
      }

    case 'submitStart':
      return { ...state, submit: { status: 'submitting', mode: action.mode } }

    case 'submitRedirecting':
      return { ...state, submit: { status: 'redirecting' } }

    case 'submitOk':
      return { ...state, submit: { status: 'done', orderRef: action.orderRef } }

    case 'submitError':
      return { ...state, submit: { status: 'error', message: action.message } }
  }
}

/** The draft in the shape the shared validator and the API expect. */
export function toOrderDraft(state: OrderState): OrderDraft {
  const d = state.delivery
  return {
    name: state.name,
    phone: state.phone,
    email: state.email,
    planId: state.planId,
    quantity: state.quantity,
    acceptTerms: state.acceptTerms,
    marketingConsent: state.marketingConsent,
    printName: state.planId === 'custom' ? state.printName : undefined,
    customization: state.planId === 'custom' ? state.customization : undefined,
    message: state.message,
    delivery: {
      type: d.type,
      cityId: d.city?.id ?? null,
      officeCode: d.officeCode,
      street: d.street,
      streetNum: d.streetNum,
      quarter: d.quarter,
      floor: d.floor,
      apt: d.apt,
      note: d.note,
      streetIsFreeform: d.streetIsFreeform,
    },
  }
}

/**
 * A stable key for everything that affects the delivery price, or null while
 * the selection is still incomplete.
 *
 * Being a pure function of state is what makes the fetch effect in
 * use-shipping-quote.ts correct without any extra bookkeeping.
 */
export function quoteKey(state: OrderState): string | null {
  const d = state.delivery
  if (!d.city) return null

  if (d.type === 'office' || d.type === 'aps') {
    if (!d.officeCode) return null
    return `${state.planId}|${state.quantity}|${d.city.id}|${d.type}|${d.officeCode}`
  }

  if (!d.street.trim() || !d.streetNum.trim()) return null
  return [
    state.planId,
    state.quantity,
    d.city.id,
    'address',
    d.street.trim(),
    d.streetNum.trim(),
    d.quarter.trim(),
    d.streetIsFreeform ? 'free' : '',
  ].join('|')
}

/** Floor, flat and note ride along on the label but never change the price. */
function pricingRelevant(field: DeliveryTextField): boolean {
  return field === 'cityQuery' || field === 'street' || field === 'streetNum' || field === 'quarter'
}

function deliveryErrorField(field: DeliveryTextField): OrderErrorField {
  switch (field) {
    case 'cityQuery':
      return 'city'
    case 'street':
      return 'street'
    case 'streetNum':
      return 'streetNum'
    default:
      return 'form'
  }
}

function without(errors: OrderErrors, ...fields: OrderErrorField[]): OrderErrors {
  if (!fields.some((f) => f in errors)) return errors
  const next = { ...errors }
  for (const f of fields) delete next[f]
  return next
}
