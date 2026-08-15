// Validation shared by the browser and the API routes.
//
// Deliberately hand-rolled rather than zod: the surface is a dozen simple
// fields, the messages have to be Bulgarian anyway, and the client imports this
// module, so a schema library's bytes would land in the bundle for no gain. The
// one thing zod would genuinely earn — parsing untrusted webhook JSON — does not
// exist yet. When Stripe webhooks arrive, reimplement behind these signatures.
//
// No React and no server-only imports here, on purpose: both sides run the same
// code, so a client that skips validation gets the identical messages back.

import { MAX_QUANTITY, plans, type PlanId } from '@/lib/data/pricing'
import { isDeliveryType, type DeliveryType } from '@/lib/econt/dto'

export type OrderErrorField =
  | 'name'
  | 'phone'
  | 'email'
  | 'model'
  | 'quantity'
  | 'deliveryType'
  | 'city'
  | 'officeCode'
  | 'street'
  | 'streetNum'
  | 'printName'
  | 'customization'
  | 'message'
  | 'acceptTerms'
  /** Not attributable to one field — render as a banner. */
  | 'form'

/**
 * How the customer wants to finish.
 *
 * 'pay' redirects to the myPOS hosted card page; 'contact' records the order and
 * we phone them. Both write the same row — only payment_status differs.
 */
export type CheckoutMode = 'pay' | 'contact'

export function isCheckoutMode(value: unknown): value is CheckoutMode {
  return value === 'pay' || value === 'contact'
}

export type OrderErrors = Partial<Record<OrderErrorField, string>>

export const LIMITS = {
  name: 100,
  email: 254,
  printName: 30,
  street: 120,
  streetNum: 10,
  floor: 5,
  apt: 10,
  note: 200,
  customization: 500,
  message: 1000,
} as const

/** Contact details, as typed into the form. */
export type ContactDraft = {
  name: string
  phone: string
  /** Required: customers.email is NOT NULL, and myPOS wants it too. */
  email: string
  planId: string
  quantity: number
  printName?: string
  customization?: string
  message?: string
  /** Distance-selling agreement. Required only when paying by card. */
  acceptTerms?: boolean
  marketingConsent?: boolean
  mode?: CheckoutMode
}

/** Where it is going, as chosen in the form. */
export type DeliveryDraft = {
  type: DeliveryType
  cityId: number | null
  officeCode: string | null
  street?: string
  streetNum?: string
  quarter?: string
  floor?: string
  apt?: string
  note?: string
  streetIsFreeform?: boolean
}

export type OrderDraft = ContactDraft & { delivery: DeliveryDraft }

/**
 * Normalize a Bulgarian mobile number to E.164, or return null.
 *
 * Mobile specifically: Econt's SMS notification is the main way a customer
 * learns their parcel has arrived, and a landline silently loses that.
 * Accepts 0881234567, +359881234567, 00359 88 123 4567 and spaced or
 * dash-separated variants.
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[\s()\-.]/g, '')
  const national = /^(?:\+359|00359|359|0)(8[7-9]\d{7})$/.exec(digits)
  return national ? `+359${national[1]}` : null
}

/**
 * Deliberately permissive: this is where a confirmation email goes, not an
 * identity check. It rejects the shapes that certainly cannot receive mail and
 * lets the confirmation itself catch the rest.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/

export function validateContact(draft: ContactDraft): OrderErrors {
  const errors: OrderErrors = {}

  const name = draft.name.trim()
  if (!name) errors.name = 'Моля, въведете име.'
  else if (name.length < 2 || !/\p{L}/u.test(name))
    errors.name = 'Моля, въведете пълното си име.'
  else if (name.length > LIMITS.name)
    errors.name = `Името е до ${LIMITS.name} символа.`

  const phone = draft.phone.trim()
  if (!phone) errors.phone = 'Моля, въведете телефон.'
  else if (!normalizePhone(phone))
    errors.phone =
      'Моля, въведете валиден български мобилен номер, напр. 0881234567.'

  const email = draft.email.trim()
  if (!email) errors.email = 'Моля, въведете имейл.'
  else if (email.length > LIMITS.email)
    errors.email = `Имейлът е до ${LIMITS.email} символа.`
  else if (!EMAIL_RE.test(email)) errors.email = 'Моля, проверете имейл адреса.'

  if (!isPlanId(draft.planId)) errors.model = 'Моля, изберете модел.'

  if (
    !Number.isInteger(draft.quantity) ||
    draft.quantity < 1 ||
    draft.quantity > MAX_QUANTITY
  ) {
    errors.quantity = `Моля, изберете количество между 1 и ${MAX_QUANTITY}.`
  }

  // Only the paying path needs the agreement; the callback path does not.
  if (draft.mode === 'pay' && draft.acceptTerms !== true) {
    errors.acceptTerms = 'Моля, приемете общите условия, за да продължите.'
  }

  const printName = (draft.printName ?? '').trim()
  if (printName.length > LIMITS.printName)
    errors.printName = `Името за печат е до ${LIMITS.printName} символа.`
  else if (/[\r\n]/.test(printName))
    errors.printName = 'Името за печат трябва да е на един ред.'

  if ((draft.customization ?? '').length > LIMITS.customization)
    errors.customization = `Текстът е до ${LIMITS.customization} символа.`

  if ((draft.message ?? '').length > LIMITS.message)
    errors.message = `Съобщението е до ${LIMITS.message} символа.`

  return errors
}

export function validateDelivery(delivery: DeliveryDraft): OrderErrors {
  const errors: OrderErrors = {}

  if (!isDeliveryType(delivery.type)) {
    errors.deliveryType = 'Моля, изберете начин на доставка.'
    return errors
  }

  // A typed city is not a chosen city: Econt needs the id, and a name alone is
  // ambiguous (three different Калояново, in three different regions).
  if (!delivery.cityId) {
    errors.city = 'Моля, изберете град от списъка.'
    return errors
  }

  if (delivery.type === 'office' || delivery.type === 'aps') {
    if (!delivery.officeCode) {
      errors.officeCode =
        delivery.type === 'aps'
          ? 'Моля, изберете автомат на Еконт.'
          : 'Моля, изберете офис на Еконт.'
    }
    return errors
  }

  const street = (delivery.street ?? '').trim()
  if (!street) errors.street = 'Моля, въведете улица.'
  else if (street.length > LIMITS.street)
    errors.street = `Улицата е до ${LIMITS.street} символа.`

  const num = (delivery.streetNum ?? '').trim()
  if (!num) errors.streetNum = 'Моля, въведете номер.'
  else if (num.length > LIMITS.streetNum)
    errors.streetNum = `Номерът е до ${LIMITS.streetNum} символа.`

  return errors
}

/** Everything the server needs, normalized and safe to act on. */
export type OrderInput = {
  name: string
  phone: string
  email: string
  planId: PlanId
  quantity: number
  printName: string | null
  customization: string | null
  message: string | null
  acceptTerms: boolean
  marketingConsent: boolean
  mode: CheckoutMode
  delivery: DeliveryDraft & { cityId: number }
}

export function validateOrder(
  draft: OrderDraft,
): { errors: OrderErrors; value?: OrderInput } {
  const errors: OrderErrors = {
    ...validateContact(draft),
    ...validateDelivery(draft.delivery),
  }

  if (Object.keys(errors).length > 0) return { errors }

  const phone = normalizePhone(draft.phone)
  const cityId = draft.delivery.cityId
  // validateContact/validateDelivery already guarantee both, but narrowing here
  // keeps OrderInput honest rather than asserting non-null.
  if (!phone || !cityId || !isPlanId(draft.planId)) {
    return { errors: { form: 'Моля, проверете данните във формата.' } }
  }

  return {
    errors: {},
    value: {
      name: draft.name.trim(),
      phone,
      email: draft.email.trim().toLowerCase(),
      planId: draft.planId,
      quantity: draft.quantity,
      printName: blankToNull(draft.printName),
      customization: blankToNull(draft.customization),
      message: blankToNull(draft.message),
      acceptTerms: draft.acceptTerms === true,
      marketingConsent: draft.marketingConsent === true,
      mode: isCheckoutMode(draft.mode) ? draft.mode : 'contact',
      delivery: { ...draft.delivery, cityId },
    },
  }
}

export function hasErrors(errors: OrderErrors): boolean {
  return Object.keys(errors).length > 0
}

export function isPlanId(value: string): value is PlanId {
  return plans.some((p) => p.id === value)
}

function blankToNull(v: string | undefined): string | null {
  const t = (v ?? '').trim()
  return t.length > 0 ? t : null
}
