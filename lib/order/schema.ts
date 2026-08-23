// Validation shared by the browser and the API routes.
//
// Deliberately hand-rolled rather than zod: the surface is a dozen simple
// fields, the messages have to be Bulgarian anyway, and the client imports this
// module, so a schema library's bytes would land in the bundle for no gain.
//
// Webhook parsing now exists, and it did NOT come back here. These signatures
// are validateX(draft) -> { errors, value }: per-field Bulgarian messages for a
// person looking at a form. A webhook has no field to attribute and no user to
// show anything to; its job is parseX(unknown) -> T | null. Forcing the two into
// one shape would have made both worse, so it lives in
// lib/payments/webhook-parse.ts, still hand-rolled and still zod-free.
//
// No React and no server-only imports here, on purpose: both sides run the same
// code, so a client that skips validation gets the identical messages back.

import { plans, type PlanId } from '@/lib/data/pricing'
import { isDeliveryType, type DeliveryType } from '@/lib/econt/dto'
import { isPaymentMethod, type PaymentMethod } from '@/lib/payments/dto'

export type OrderErrorField =
  | 'name'
  | 'phone'
  | 'email'
  | 'paymentMethod'
  | 'model'
  | 'deliveryType'
  | 'city'
  | 'officeCode'
  | 'street'
  | 'streetNum'
  | 'printName'
  | 'customization'
  | 'message'
  /** Not attributable to one field — render as a banner. */
  | 'form'

export type OrderErrors = Partial<Record<OrderErrorField, string>>

export const LIMITS = {
  name: 100,
  // RFC 5321's practical maximum for a whole address.
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
  email: string
  planId: string
  paymentMethod: string
  printName?: string
  customization?: string
  message?: string
  marketingConsent?: boolean
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
 * Normalize an email, or return null.
 *
 * Lowercased and trimmed because the database stores it that way and uses it as
 * the customer's unique key — 'Ivan@x.bg' and 'ivan@x.bg' must not become two
 * customers. The shape check is deliberately loose: the only authority on
 * whether an address works is whether mail to it arrives, and over-strict
 * patterns reject valid addresses far more often than they catch typos.
 */
export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase()
  if (email.length < 3 || email.length > LIMITS.email) return null
  if (/\s/.test(email)) return null

  const at = email.indexOf('@')
  // Must have a local part, a domain, exactly one @, and a dot in the domain.
  if (at < 1 || at !== email.lastIndexOf('@')) return null
  const domain = email.slice(at + 1)
  if (domain.length < 3 || !domain.includes('.')) return null
  if (domain.startsWith('.') || domain.endsWith('.')) return null

  return email
}

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
  else if (!normalizeEmail(email))
    errors.email = 'Моля, въведете валиден имейл адрес, напр. ivan@example.com.'

  if (!isPlanId(draft.planId)) errors.model = 'Моля, изберете модел.'

  if (!isPaymentMethod(draft.paymentMethod))
    errors.paymentMethod = 'Моля, изберете начин на плащане.'

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
  paymentMethod: PaymentMethod
  marketingConsent: boolean
  printName: string | null
  customization: string | null
  message: string | null
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
  const email = normalizeEmail(draft.email)
  const cityId = draft.delivery.cityId
  // validateContact/validateDelivery already guarantee these, but narrowing here
  // keeps OrderInput honest rather than asserting non-null.
  if (
    !phone ||
    !email ||
    !cityId ||
    !isPlanId(draft.planId) ||
    !isPaymentMethod(draft.paymentMethod)
  ) {
    return { errors: { form: 'Моля, проверете данните във формата.' } }
  }

  return {
    errors: {},
    value: {
      name: draft.name.trim(),
      phone,
      email,
      planId: draft.planId,
      paymentMethod: draft.paymentMethod,
      marketingConsent: draft.marketingConsent === true,
      printName: blankToNull(draft.printName),
      customization: blankToNull(draft.customization),
      message: blankToNull(draft.message),
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
