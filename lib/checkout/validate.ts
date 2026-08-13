import { getPlan, MAX_QUANTITY, type PlanId } from '@/lib/data/pricing'

/**
 * Checkout validation shared by the modal and the API route.
 *
 * Pure and dependency-free so the client can reuse it for inline errors while
 * the server re-runs it authoritatively. Messages are the user-facing Bulgarian
 * copy, matching the tone of the original enquiry form.
 */

export type CheckoutMode = 'pay' | 'contact'

export type CheckoutInput = {
  mode: CheckoutMode
  planId: PlanId
  quantity: number
  name: string
  email: string
  phone: string
  city: string
  printName?: string
  customization?: string
  message?: string
  acceptTerms: boolean
  marketingConsent: boolean
}

export type CheckoutFieldKey =
  | 'name'
  | 'email'
  | 'phone'
  | 'city'
  | 'planId'
  | 'quantity'
  | 'acceptTerms'

export type CheckoutErrors = Partial<Record<CheckoutFieldKey, string>>

const MAX_LENGTHS = {
  name: 120,
  email: 254,
  phone: 40,
  city: 160,
  printName: 60,
  customization: 500,
  message: 1000,
} as const

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function bool(value: unknown): boolean {
  return value === true
}

/**
 * Deliberately permissive: this is a delivery contact address, not an identity
 * check. It rejects the shapes that certainly cannot receive mail and lets the
 * confirmation email catch the rest.
 */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value)
}

/** Needs enough digits to be a real Bulgarian or international number. */
function looksLikePhone(value: string): boolean {
  const digits = value.replace(/[^\d]/g, '')
  return digits.length >= 6 && digits.length <= 15
}

/**
 * Normalises an unknown request body into a CheckoutInput plus field errors.
 * `errors` empty means `input` is safe to act on.
 */
export function validateCheckout(body: unknown): {
  input: CheckoutInput
  errors: CheckoutErrors
} {
  const raw = (typeof body === 'object' && body !== null ? body : {}) as Record<
    string,
    unknown
  >

  const mode: CheckoutMode = raw.mode === 'contact' ? 'contact' : 'pay'

  const name = str(raw.name).slice(0, MAX_LENGTHS.name)
  const email = str(raw.email).slice(0, MAX_LENGTHS.email).toLowerCase()
  const phone = str(raw.phone).slice(0, MAX_LENGTHS.phone)
  const city = str(raw.city).slice(0, MAX_LENGTHS.city)
  const printName = str(raw.printName).slice(0, MAX_LENGTHS.printName)
  const customization = str(raw.customization).slice(0, MAX_LENGTHS.customization)
  const message = str(raw.message).slice(0, MAX_LENGTHS.message)

  const planId = str(raw.planId) as PlanId
  const plan = getPlan(planId)

  const rawQuantity = Number(raw.quantity)
  const quantity =
    Number.isInteger(rawQuantity) && rawQuantity >= 1 && rawQuantity <= MAX_QUANTITY
      ? rawQuantity
      : NaN

  const acceptTerms = bool(raw.acceptTerms)
  const marketingConsent = bool(raw.marketingConsent)

  const errors: CheckoutErrors = {}

  if (!name) errors.name = 'Моля, въведете име.'

  if (!email) errors.email = 'Моля, въведете имейл.'
  else if (!looksLikeEmail(email)) errors.email = 'Моля, проверете имейл адреса.'

  if (!phone) errors.phone = 'Моля, въведете телефон.'
  else if (!looksLikePhone(phone)) errors.phone = 'Моля, проверете телефонния номер.'

  if (!city) errors.city = 'Моля, въведете град или офис на куриер.'

  if (!plan) errors.planId = 'Моля, изберете модел.'

  if (!Number.isFinite(quantity)) {
    errors.quantity = `Моля, изберете количество между 1 и ${MAX_QUANTITY}.`
  }

  // Only the paying path needs the distance-selling agreement.
  if (mode === 'pay' && !acceptTerms) {
    errors.acceptTerms = 'Моля, приемете общите условия, за да продължите.'
  }

  return {
    input: {
      mode,
      planId,
      quantity: Number.isFinite(quantity) ? quantity : 1,
      name,
      email,
      phone,
      city,
      printName: printName || undefined,
      customization: customization || undefined,
      message: message || undefined,
      acceptTerms,
      marketingConsent,
    },
    errors,
  }
}

/**
 * Splits a full name into the first/family parts myPOS asks for. Bulgarian
 * names are usually "Име Презиме Фамилия" — everything before the last token is
 * treated as given names.
 */
export function splitName(fullName: string): {
  firstNames: string
  familyName: string
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstNames: '', familyName: '' }
  if (parts.length === 1) return { firstNames: parts[0], familyName: parts[0] }
  return {
    firstNames: parts.slice(0, -1).join(' '),
    familyName: parts[parts.length - 1],
  }
}
