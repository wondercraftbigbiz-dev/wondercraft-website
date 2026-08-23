// PaymentIntent metadata: the handles needed to reconcile a charge with an
// order, and nothing else.
//
// Metadata is visible in the Stripe Dashboard, in every exported report, and to
// anyone with dashboard access. It is not a customer database. Personal data
// belongs in public.orders, behind the service-role key, where it can be
// queried, corrected and deleted on request.
//
// Pure and dependency-light on purpose, so scripts/check-payment.ts can assert
// the denylist and the limits with bare node.

import { createHash } from 'node:crypto'

/** Stripe's limits: 50 keys, key <= 40 chars, value <= 500 chars. */
export const METADATA_LIMITS = { keys: 50, keyChars: 40, valueChars: 500 } as const

/**
 * Field names that must never appear as a metadata key.
 *
 * Asserted in check-payment.ts both by key name and by searching the serialized
 * metadata for the fixture's own name, phone and street — a denylist of keys
 * alone would not have caught the quote id carrying a street address, which is
 * exactly the mistake that motivated the hash below.
 */
export const PII_KEYS: readonly string[] = [
  'name',
  'fullName',
  'contactName',
  'phone',
  'email',
  'street',
  'streetNum',
  'quarter',
  'floor',
  'apt',
  'note',
  'deliveryNote',
  'printName',
  'customization',
  'message',
  'address',
] as const

export type IntentMetadataArgs = {
  orderRef: string
  attemptId: string
  planId: string
  sku: string
  quoteId: string | null
  cityId: number
  deliveryType: string
  officeCode: string | null
  productEurCents: number
  shippingEurCents: number
}

/**
 * Build the metadata for a PaymentIntent.
 *
 * `quoteId` is hashed rather than sent. lib/econt/shipping.ts builds the quote
 * key from the destination, so for address delivery it embeds the street and
 * house number. That is address data, and it has no business sitting in a
 * payment dashboard. The full value stays on the order row, which is where the
 * reprice check reads it from anyway.
 */
export function buildIntentMetadata(
  args: IntentMetadataArgs,
): Record<string, string> {
  const metadata: Record<string, string> = {
    orderRef: args.orderRef,
    attemptId: args.attemptId,
    planId: args.planId,
    sku: args.sku,
    cityId: String(args.cityId),
    deliveryType: args.deliveryType,
    productEurCents: String(args.productEurCents),
    shippingEurCents: String(args.shippingEurCents),
    site: 'wondercraft',
  }

  if (args.officeCode) metadata.officeCode = args.officeCode
  if (args.quoteId) metadata.quoteIdHash = hashQuoteId(args.quoteId)

  return clamp(metadata)
}

/** First 16 hex of sha256. Enough to correlate, not enough to reverse. */
export function hashQuoteId(quoteId: string): string {
  return createHash('sha256').update(quoteId).digest('hex').slice(0, 16)
}

/**
 * Enforce Stripe's limits rather than letting it reject the whole intent.
 *
 * A truncated metadata value costs a little debuggability. A rejected
 * PaymentIntent costs the sale.
 */
function clamp(metadata: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (Object.keys(out).length >= METADATA_LIMITS.keys) break
    out[key.slice(0, METADATA_LIMITS.keyChars)] = value.slice(
      0,
      METADATA_LIMITS.valueChars,
    )
  }
  return out
}
