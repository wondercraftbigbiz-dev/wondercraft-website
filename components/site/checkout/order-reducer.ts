import { VCity } from '@/lib/bg'
import type { CityDto, DeliveryType, MoneyDto } from '@/lib/econt/dto'
import type { PlanId } from '@/lib/data/pricing'
import type { OrderDraft, OrderErrorField, OrderErrors } from '@/lib/order/schema'

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
      /** Epoch ms. Enforced by useQuoteExpiry in use-shipping-quote.ts. */
      expiresAt: number
    }
  | { status: 'error'; message: string }

/**
 * The card payment, from "show me the form" to "it went through".
 *
 * `ready` deliberately survives a decline: the same PaymentIntent can be
 * retried with another card, and recreating one per decline would orphan rows
 * and degrade Stripe's fraud signals. `lastError` carries the decline message.
 */
export type PayState =
  | { status: 'idle' }
  | { status: 'creating' }
  | {
      status: 'ready'
      clientSecret: string
      orderRef: string
      total: MoneyDto
      lastError: string | null
    }
  /**
   * Stripe has it. Includes the 3DS window, during which the modal locks.
   * Carries the intent forward: a decline returns to `ready` on the SAME client
   * secret, so dropping it here would force a needless new PaymentIntent.
   */
  | {
      status: 'confirming'
      clientSecret: string
      orderRef: string
      total: MoneyDto
    }
  | { status: 'error'; message: string; retryable: boolean }

/** Which half of the modal is showing. */
export type Step = 'details' | 'payment'

/**
 * Whether the order has completed.
 *
 * Only 'done' beyond idle: the modal no longer posts anything of its own. The
 * details step moves to payment locally, and everything that can go wrong from
 * there is a payment failure, which PayState owns.
 */
export type SubmitState =
  | { status: 'idle' }
  | { status: 'done'; orderRef: string }

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
  marketingConsent: boolean
  step: Step
  /** Minted once per payment attempt. Null until the payment step is entered. */
  attemptId: string | null
  /**
   * Bumped when a quote is discarded for a reason the destination did not
   * change — currently only expiry.
   *
   * quoteKey() is a pure function of the destination, so it cannot express "the
   * same destination, but ask again". Without this the refetch effect would not
   * re-run after an expiry, because its key would be identical.
   */
  quoteNonce: number
  printName: string
  customization: string
  message: string
  delivery: DeliveryState
  errors: OrderErrors
  /** Non-blocking guidance, e.g. "no office in this city, use an address". */
  notice: string | null
  quote: QuoteState
  submit: SubmitState
  pay: PayState
}

export type TextField =
  | 'name'
  | 'phone'
  | 'email'
  | 'printName'
  | 'customization'
  | 'message'

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
  | { type: 'setMarketingConsent'; value: boolean }
  | { type: 'goToPayment'; attemptId: string }
  | { type: 'backToDetails' }
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
      expiresAt: number
    }
  | { type: 'quoteError'; message: string }
  | { type: 'quoteExpired' }
  | { type: 'intentStart' }
  | {
      type: 'intentReady'
      clientSecret: string
      orderRef: string
      total: MoneyDto
    }
  | { type: 'intentError'; message: string; retryable: boolean }
  | { type: 'payConfirming' }
  | { type: 'payDeclined'; message: string }
  | { type: 'payError'; message: string; retryable: boolean }
  | { type: 'submitOk'; orderRef: string }

const IDLE_QUOTE: QuoteState = { status: 'idle' }
const IDLE_PAY: PayState = { status: 'idle' }

/**
 * Everything that must be discarded when the price could have moved.
 *
 * The quote was already reset at each of these transitions. The payment now has
 * to go with it: a client secret is bound to one amount, so letting a customer
 * switch from the 30 EUR model to the 40 EUR one while holding an intent created
 * for the old total is how a shop charges the wrong price. Sending them back to
 * the details step is not optional either, since the payment step renders off a
 * quote that no longer exists.
 */
function invalidatePricing(): Pick<OrderState, 'quote' | 'pay' | 'step' | 'attemptId'> {
  return { quote: IDLE_QUOTE, pay: IDLE_PAY, step: 'details', attemptId: null }
}

export function initialOrderState(planId: PlanId): OrderState {
  return {
    name: '',
    phone: '',
    email: '',
    planId,
    marketingConsent: false,
    step: 'details',
    attemptId: null,
    quoteNonce: 0,
    printName: '',
    customization: '',
    message: '',
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
    pay: IDLE_PAY,
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
        ...invalidatePricing(),
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
        ...(pricingRelevant(action.field) ? invalidatePricing() : {}),
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
        ...invalidatePricing(),
        errors: without(state.errors, 'city', 'officeCode', 'street', 'streetNum'),
      }
    }

    case 'selectOffice':
      return {
        ...state,
        delivery: { ...state.delivery, officeCode: action.code },
        ...invalidatePricing(),
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
        ...invalidatePricing(),
        errors: without(state.errors, 'street'),
      }

    case 'setMarketingConsent':
      return { ...state, marketingConsent: action.value }

    case 'goToPayment':
      return { ...state, step: 'payment', attemptId: action.attemptId, pay: IDLE_PAY }

    case 'backToDetails':
      // Drop the intent as well as the step. The details are about to become
      // editable again, and the row was written from them.
      return { ...state, step: 'details', attemptId: null, pay: IDLE_PAY }

    case 'intentStart':
      return { ...state, pay: { status: 'creating' } }

    case 'intentReady':
      return {
        ...state,
        pay: {
          status: 'ready',
          clientSecret: action.clientSecret,
          orderRef: action.orderRef,
          total: action.total,
          lastError: null,
        },
      }

    case 'intentError':
      return {
        ...state,
        pay: { status: 'error', message: action.message, retryable: action.retryable },
      }

    case 'payConfirming':
      // Only meaningful from 'ready'; anything else is a stray dispatch.
      return state.pay.status === 'ready'
        ? {
            ...state,
            pay: {
              status: 'confirming',
              clientSecret: state.pay.clientSecret,
              orderRef: state.pay.orderRef,
              total: state.pay.total,
            },
          }
        : state

    case 'payDeclined':
      // Back to 'ready' on the same client secret, so another card can be tried
      // without creating a second PaymentIntent.
      return state.pay.status === 'confirming'
        ? {
            ...state,
            pay: {
              status: 'ready',
              clientSecret: state.pay.clientSecret,
              orderRef: state.pay.orderRef,
              total: state.pay.total,
              lastError: action.message,
            },
          }
        : state

    case 'payError':
      return {
        ...state,
        pay: { status: 'error', message: action.message, retryable: action.retryable },
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
          expiresAt: action.expiresAt,
        },
      }

    case 'quoteError':
      return { ...state, quote: { status: 'error', message: action.message } }

    case 'quoteExpired':
      // The delivery price has a shelf life and it has run out. Discard it, send
      // the customer back to the details step, and ask again — the destination
      // has not changed, so quoteNonce is what makes the refetch fire.
      //
      // Never fires mid-payment: use-shipping-quote does not arm the timer while
      // Stripe has the payment, because yanking state out from under a 3DS
      // challenge is worse than honouring a slightly stale price.
      return {
        ...state,
        ...invalidatePricing(),
        quoteNonce: state.quoteNonce + 1,
      }

    case 'submitOk':
      return { ...state, submit: { status: 'done', orderRef: action.orderRef } }

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
    return `${state.planId}|${d.city.id}|${d.type}|${d.officeCode}`
  }

  if (!d.street.trim() || !d.streetNum.trim()) return null
  return [
    state.planId,
    d.city.id,
    'address',
    d.street.trim(),
    d.streetNum.trim(),
    d.quarter.trim(),
    d.streetIsFreeform ? 'free' : '',
  ].join('|')
}

/**
 * A stable key for one payable amount, or null when there is nothing to pay for.
 *
 * Null unless the customer is actually on the payment step, has chosen card, has
 * a live quote, and has an attempt id. A changed key voids any client secret
 * held against the old one — same contract as quoteKey(), one level up.
 */
export function intentKey(state: OrderState): string | null {
  if (state.step !== 'payment') return null
  if (state.quote.status !== 'ok') return null
  if (!state.attemptId) return null

  const base = quoteKey(state)
  if (!base) return null

  return `${base}|${state.quote.quoteId}|${state.quote.total.cents}|${state.attemptId}`
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
