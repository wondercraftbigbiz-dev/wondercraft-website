// The client-safe half of the Econt integration.
//
// Everything here crosses the network to the browser, so it is deliberately
// narrow: trimmed, pre-formatted, and free of anything Econt returns that the
// UI does not render. No `server-only` here — the checkout components import
// these types directly.

export type DeliveryType = 'office' | 'aps' | 'address'

export const DELIVERY_TYPES: readonly DeliveryType[] = [
  'office',
  'aps',
  'address',
] as const

export function isDeliveryType(v: unknown): v is DeliveryType {
  return typeof v === 'string' && (DELIVERY_TYPES as readonly string[]).includes(v)
}

export type CityDto = {
  id: number
  name: string
  nameEn: string
  postCode: string
  region: string
  /** Has at least one walk-in office, so `office` delivery is offerable. */
  hasOffice: boolean
  /** Has at least one automat, so `aps` delivery is offerable. */
  hasAps: boolean
}

export type OfficeDto = {
  code: string
  name: string
  /** Pre-flattened one-liner: "ул. Иван Вазов 12, кв. Център". */
  address: string
  isAps: boolean
  isMps: boolean
  /** "08:30 – 18:00", or null when Econt gives us no hours. */
  hours: string | null
  phone: string | null
}

export type StreetDto = { id: number; name: string }
export type QuarterDto = { id: number; name: string }

export type CitiesResponse = { cities: CityDto[] }
export type OfficesResponse = { offices: OfficeDto[] }
export type CityDetailsResponse = { streets: StreetDto[]; quarters: QuarterDto[] }

/** Money over the wire: integer minor units, so no float drift in JSON. */
export type MoneyDto = { cents: number; currency: 'EUR' | 'BGN' }

/** The delivery destination, as the browser knows it. */
export type DeliveryDto = {
  type: DeliveryType
  cityId: number
  /** Set for type 'office' | 'aps'. */
  officeCode?: string
  /** Set for type 'address'. */
  street?: string
  streetNum?: string
  quarter?: string
  floor?: string
  apt?: string
  note?: string
  /** True when the street was typed freehand because it is not in Econt's list. */
  streetIsFreeform?: boolean
}

/**
 * A quote request carries the plan id and nothing else about the product.
 *
 * Weight, dimensions, pack count and product value are resolved server-side
 * from lib/data/pricing.ts. This is the pricing-integrity boundary: a client
 * able to send `weight` could quote itself free shipping, and once Stripe is
 * wired up, underpay. Do not widen this type with product fields.
 */
export type QuoteRequest = {
  planId: string
  delivery: DeliveryDto
}

export type QuoteOk = {
  ok: true
  product: MoneyDto
  shipping: MoneyDto
  total: MoneyDto
  /** Opaque handle so the order route can spot a quote it no longer agrees with. */
  quoteId: string
  /** Epoch ms. Advisory today; a hard gate once payment is involved. */
  expiresAt: number
}

export type QuoteFailed = {
  ok: false
  message: string
  /** The field the customer should fix, when we can attribute it. */
  field?: string
}

export type QuoteResponse = QuoteOk | QuoteFailed

export type OrderOk = {
  ok: true
  orderRef: string
  /** The database's sequential reference, shown to the customer. */
  orderNumber: number
  total: MoneyDto
  shipping: MoneyDto | null
  /**
   * Where to send the browser to pay. Null when there is nothing payable — no
   * delivery quote, so no honest total — and the shop confirms by phone instead.
   */
  checkoutUrl: string | null
}

export type OrderFailed = {
  ok: false
  message: string
  field?: string
  errors?: Record<string, string>
}

export type OrderResponse = OrderOk | OrderFailed

/**
 * Automat parcel limits, mirrored client-side so the UI can grey out the
 * automat option before asking the server. The server's copy in constraints.ts
 * is authoritative and env-overridable; this is a fast path, not a rule.
 */
export const APS_MAX_PARCEL_HINT = {
  weightKg: 20,
  lengthCm: 60,
  widthCm: 40,
  heightCm: 40,
} as const
