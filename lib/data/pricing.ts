// Single source of truth for pricing. Never hardcode a price in a component.
// Bulgarian convention: comma decimal, symbol after number.
//
// `priceEurCents` is authoritative; `lev`/`euro` below are display mirrors kept
// for the existing marketing copy. Anything that does arithmetic (delivery
// quotes, order totals, Stripe later) must read the cents, never the strings.
//
// Deliberately dependency-free: scripts/check-money.ts imports it with bare
// node, which cannot resolve the "@/" alias. Wrap prices with eur() at the call
// site rather than importing lib/money here.

/** Packed shipping parcel. Econt prices on weight AND volumetric weight. */
export type Parcel = {
  weightKg: number
  lengthCm: number
  widthCm: number
  heightCm: number
}

// ============================================================================
// TODO(owner): replace with values measured off a real packed (flat-pack) box.
// Econt charges by weight and by volumetric weight, so wrong numbers here mean
// wrong delivery prices at checkout — quoted too low, absorbed by us.
//
//   Measured by: ______________  on: ____________
//
// Until every field is > 0, isParcelConfigured() returns false and the delivery
// quote fails loudly (see lib/econt/shipping.ts) instead of sending weight: 0
// to Econt and undercharging every order.
// ============================================================================
export const PACKED_PARCEL: Parcel = {
  weightKg: 0, // TODO
  lengthCm: 0, // TODO
  widthCm: 0, // TODO
  heightCm: 0, // TODO
}

export function isParcelConfigured(parcel: Parcel = PACKED_PARCEL): boolean {
  return (
    parcel.weightKg > 0 &&
    parcel.lengthCm > 0 &&
    parcel.widthCm > 0 &&
    parcel.heightCm > 0
  )
}

/**
 * The parcel for `count` houses shipped together.
 *
 * The houses ship flat-packed, so N of them stack rather than travelling as N
 * separate boxes: weight multiplies, and only the SMALLEST dimension grows —
 * stacking N flat boxes makes the pile N times thicker while its footprint stays
 * the same. Multiplying all three dimensions would overstate volumetric weight
 * roughly N³ and quote a wildly high price.
 *
 * Rounded to whole centimetres because Econt prices on whole units.
 */
export function stackParcels(parcel: Parcel, count: number): Parcel {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`stackParcels: count must be a positive integer, got ${count}`)
  }
  if (count === 1) return parcel

  const dims: Array<keyof Parcel> = ['lengthCm', 'widthCm', 'heightCm']
  const thinnest = dims.reduce((min, d) => (parcel[d] < parcel[min] ? d : min), dims[0])

  return {
    ...parcel,
    weightKg: Math.round(parcel.weightKg * count * 1000) / 1000,
    [thinnest]: Math.ceil(parcel[thinnest] * count),
  }
}

export type Plan = {
  id: 'standard' | 'custom'
  name: string
  lev: string // primary price, e.g. "60 лв."
  euro: string // secondary price, e.g. "30,67 €"
  tagline: string
  features: string[]
  featured: boolean
  image: string
  imageAlt: string
  /** Authoritative price in eurocents. `lev`/`euro` are display mirrors. */
  priceEurCents: number
  /** Packed parcel used for the Econt delivery quote. */
  parcel: Parcel
  sku: string
}

export const plans: Plan[] = [
  {
    id: 'standard',
    name: 'Стандартен',
    lev: '58,67 лв.',
    euro: '30 €',
    tagline: 'Класическата къщичка, готова за игра.',
    features: [
      '100% рециклиран картон',
      'Сглобяване за 15 минути без инструменти',
      'Прибира се плоско за съхранение',
      'Видео ръководство за сглобяване',
      'Безопасни, заоблени ръбове',
    ],
    featured: false,
    image: '/images/model-standard.webp',
    imageAlt: 'Стандартна картонена къщичка за игра',
    priceEurCents: 3000,
    parcel: PACKED_PARCEL,
    sku: 'WC-STD-01',
  },
  {
    id: 'custom',
    name: 'Персонализиран',
    lev: '78,23 лв.',
    euro: '40 €',
    tagline: 'С името на детето, отпечатано върху къщичката.',
    features: [
      'Всичко от стандартния модел',
      'Име на детето, отпечатано на къщичката',
      'Допълнителна персонализация по избор',
      'Идеален подарък за рожден ден',
      'Видео ръководство за сглобяване',
    ],
    featured: true,
    image: '/images/model-custom.webp',
    imageAlt: 'Персонализирана картонена къщичка с име на детето',
    priceEurCents: 4000,
    parcel: PACKED_PARCEL,
    sku: 'WC-CUS-01',
  },
]

// The lowest price, used in hero and metadata copy.
export const startingPrice = {
  lev: '58,67 лв.',
  euro: '30 €',
}

export const startingPriceEurCents = 3000

export type PlanId = Plan['id']

/**
 * Most houses one order may contain.
 *
 * A bare constant rather than anything computed, so this file stays importable
 * by scripts/check-money.ts under bare node (see the header note).
 */
export const MAX_QUANTITY = 10

export function findPlan(id: string): Plan | undefined {
  return plans.find((p) => p.id === id)
}
