import { getMyposConfig, type MyposConfig } from './config'
import { signFields, type MyposField } from './sign'

/**
 * Builds a signed IPCPurchase field list. The browser POSTs these to
 * config.endpoint as a plain HTML form, which is the only way myPOS Checkout
 * accepts a purchase — there is no JSON API for starting one.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * FIELD ORDER IS PART OF THE PROTOCOL. The signature is computed over the
 * values in the order they appear below, so reordering anything here silently
 * invalidates every request. If myPOS rejects requests with a signature error,
 * this ordering is the first thing to check against the official spec
 * (myPOS_Checkout_API v1.4, "IPCPurchase").
 * ────────────────────────────────────────────────────────────────────────────
 */

export const IPC_VERSION = '1.4'
export const IPC_SOURCE = 'WONDERCRAFT_NEXT_1.0'

/** Do not ask myPOS to tokenise the card — we never want to store one. */
export const CARD_TOKEN_REQUEST_NONE = '0'
/** Simplified payment page: we already collected the customer's details. */
export const PAYMENT_PARAMETERS_SIMPLIFIED = '1'
/** Standard card payment. */
export const PAYMENT_METHOD_STANDARD = '1'

export type PurchaseCartItem = {
  /** Human-readable line description shown on the myPOS page. */
  article: string
  quantity: number
  /** Unit price. */
  priceEur: number
}

export type PurchaseCustomer = {
  email: string
  phone: string
  firstNames: string
  familyName: string
  city?: string
  /** ISO 3166-1 alpha-3, as myPOS expects. */
  country?: string
  zipCode?: string
  address?: string
}

export type PurchaseInput = {
  /** Our reference, sent as OrderID and used as the payment idempotency key. */
  orderId: string
  items: PurchaseCartItem[]
  customer: PurchaseCustomer
  /** Free-text note that appears against the transaction. */
  note?: string
  /** myPOS interface language for the hosted page. */
  language?: string
}

export type PurchaseRequest = {
  /** Where the browser must POST. */
  action: string
  /** Ordered name/value pairs, Signature last. */
  fields: MyposField[]
}

/** myPOS wants a plain decimal with two places and a dot separator. */
function money(amount: number): string {
  return amount.toFixed(2)
}

function lineTotal(item: PurchaseCartItem): number {
  return Math.round(item.priceEur * item.quantity * 100) / 100
}

export function purchaseTotalEur(items: readonly PurchaseCartItem[]): number {
  return Math.round(items.reduce((sum, item) => sum + lineTotal(item), 0) * 100) / 100
}

export function buildPurchaseRequest(
  input: PurchaseInput,
  config: MyposConfig = getMyposConfig(),
): PurchaseRequest {
  if (input.items.length === 0) {
    throw new Error('Cannot build a myPOS purchase with an empty cart.')
  }

  const currency = 'EUR'
  const total = purchaseTotalEur(input.items)
  const { customer } = input

  const fields: MyposField[] = [
    ['IPCmethod', 'IPCPurchase'],
    ['IPCVersion', IPC_VERSION],
    ['IPCLanguage', input.language ?? 'BG'],
    ['SID', config.sid],
    ['WalletNumber', config.walletNumber],
    ['KeyIndex', config.keyIndex],
    ['Source', IPC_SOURCE],
    ['Currency', currency],
    ['Amount', money(total)],
    ['OrderID', input.orderId],
    ['URL_OK', `${config.siteUrl}/order/success?order=${encodeURIComponent(input.orderId)}`],
    ['URL_Cancel', `${config.siteUrl}/order/cancel?order=${encodeURIComponent(input.orderId)}`],
    ['URL_Notify', `${config.siteUrl}/api/mypos/notify`],
    ['Note', input.note ?? ''],
    ['customeremail', customer.email],
    ['customerphone', customer.phone],
    ['customerfirstnames', customer.firstNames],
    ['customerfamilyname', customer.familyName],
    ['customercountry', customer.country ?? 'BGR'],
    ['customercity', customer.city ?? ''],
    ['customerzipcode', customer.zipCode ?? ''],
    ['customeraddress', customer.address ?? ''],
    ['CartItems', String(input.items.length)],
  ]

  // Cart lines are 1-indexed and each line's five fields stay together.
  input.items.forEach((item, index) => {
    const n = index + 1
    fields.push(
      [`Article_${n}`, item.article],
      [`Quantity_${n}`, String(item.quantity)],
      [`Price_${n}`, money(item.priceEur)],
      [`Amount_${n}`, money(lineTotal(item))],
      [`Currency_${n}`, currency],
    )
  })

  fields.push(
    ['CardTokenRequest', CARD_TOKEN_REQUEST_NONE],
    ['PaymentParametersRequired', PAYMENT_PARAMETERS_SIMPLIFIED],
    ['PaymentMethod', PAYMENT_METHOD_STANDARD],
  )

  // Signature covers every field above, in exactly this order, and is appended last.
  fields.push(['Signature', signFields(fields, config.privateKey)])

  return { action: config.endpoint, fields }
}
