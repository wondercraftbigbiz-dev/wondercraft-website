import { plans, type Plan } from '@/lib/data/pricing'

/**
 * Bulgarian convention: comma decimal, symbol after the number — matching the
 * strings already in lib/data/pricing.ts.
 */
export function formatLev(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} лв.`
}

export function planLev(model: Plan['id']): string {
  return plans.find((p) => p.id === model)?.lev ?? ''
}

/**
 * Parses the "58,67 лв." strings in pricing.ts back into a number.
 *
 * Match the number explicitly rather than stripping non-numeric characters —
 * the trailing period in "лв." survives a strip and yields "58.67.", which is NaN.
 */
function parseLev(value: string): number | null {
  const match = value.match(/(\d+(?:[.,]\d+)?)/)
  if (!match) return null
  const parsed = Number(match[1].replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

export function totalLev(model: Plan['id'], shipping: number): string {
  const base = parseLev(planLev(model))
  if (base == null) return planLev(model)
  return formatLev(base + shipping)
}
