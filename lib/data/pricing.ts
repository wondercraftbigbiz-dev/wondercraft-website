// Single source of truth for pricing. Never hardcode a price in a component.
// Bulgarian convention: comma decimal, symbol after number.
//
// `priceEur` is the authoritative number — it is what the customer is actually
// charged. The `euro` / `lev` strings below are *derived* from it so a display
// string can never drift away from the amount we send to the payment provider.

/** Irrevocable BGN/EUR conversion rate fixed for Bulgaria's euro adoption. */
export const BGN_PER_EUR = 1.95583

/** The currency we charge in. Bulgaria adopted the euro on 2026-01-01. */
export const CHARGE_CURRENCY = 'EUR'

/** Round to whole cents. Money must never carry binary float dust. */
export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100
}

// Integers render bare ("30 €"), fractions render with two decimals and a
// comma ("58,67 лв."), which is how the prices have always appeared on the site.
function formatAmount(amount: number): string {
  const rounded = roundMoney(amount)
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace('.', ',')
}

export function formatEur(amount: number): string {
  return `${formatAmount(amount)} €`
}

export function formatBgn(amount: number): string {
  return `${formatAmount(amount)} лв.`
}

/** The lev equivalent of a euro amount, for the informational secondary price. */
export function eurToBgn(amountEur: number): number {
  return roundMoney(amountEur * BGN_PER_EUR)
}

export type PlanId = 'standard' | 'custom'

export type Plan = {
  id: PlanId
  name: string
  /** Authoritative price per unit, in euro. This is what gets charged. */
  priceEur: number
  lev: string // secondary display price, derived — e.g. "58,67 лв."
  euro: string // primary display price, derived — e.g. "30 €"
  tagline: string
  features: string[]
  featured: boolean
  image: string
  imageAlt: string
}

type PlanSeed = Omit<Plan, 'lev' | 'euro'>

const planSeeds: PlanSeed[] = [
  {
    id: 'standard',
    name: 'Стандартен',
    priceEur: 30,
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
  },
  {
    id: 'custom',
    name: 'Персонализиран',
    priceEur: 40,
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
  },
]

export const plans: Plan[] = planSeeds.map((seed) => ({
  ...seed,
  euro: formatEur(seed.priceEur),
  lev: formatBgn(eurToBgn(seed.priceEur)),
}))

/**
 * Look a plan up by id. Server-side code must price orders through this and
 * never trust an amount sent by the browser.
 */
export function getPlan(id: string): Plan | undefined {
  return plans.find((plan) => plan.id === id)
}

export const MAX_QUANTITY = 10

/** Order total in euro for a given plan and quantity. */
export function orderTotalEur(plan: Plan, quantity: number): number {
  return roundMoney(plan.priceEur * quantity)
}

// The lowest price, used in hero and metadata copy.
const cheapestPlan = plans.reduce((cheapest, plan) =>
  plan.priceEur < cheapest.priceEur ? plan : cheapest,
)

export const startingPrice = {
  lev: cheapestPlan.lev,
  euro: cheapestPlan.euro,
}
