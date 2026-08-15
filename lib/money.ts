// Money as integer cents. Never use floats for prices — 0.1 + 0.2 problems turn
// into off-by-a-stotinka bugs on invoices.
//
// EUR is authoritative for this shop; BGN is always derived. The lev strings in
// lib/data/pricing.ts are display mirrors of the EUR values and must agree with
// what toBgn() produces here (there is a check in scripts/check-money.ts).

/** Fixed ERM II rate, locked for Bulgaria's euro changeover. */
export const BGN_PER_EUR = 1.95583

export type Currency = 'EUR' | 'BGN'

export type Money = {
  /** Integer minor units — eurocents or stotinki. */
  cents: number
  currency: Currency
}

export function eur(cents: number): Money {
  return { cents: Math.round(cents), currency: 'EUR' }
}

export function bgn(cents: number): Money {
  return { cents: Math.round(cents), currency: 'BGN' }
}

/**
 * Convert to BGN, rounding half-up at the stotinka.
 *
 * Round ONCE, on the final total — never on intermediate sums, or the parts
 * stop adding up to the whole.
 */
export function toBgn(m: Money): Money {
  if (m.currency === 'BGN') return m
  return bgn(roundHalfUp(m.cents * BGN_PER_EUR))
}

export function toEur(m: Money): Money {
  if (m.currency === 'EUR') return m
  return eur(roundHalfUp(m.cents / BGN_PER_EUR))
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(
      `addMoney: currency mismatch (${a.currency} + ${b.currency}). Convert first.`,
    )
  }
  return { cents: a.cents + b.cents, currency: a.currency }
}

export function isZero(m: Money): boolean {
  return m.cents === 0
}

export function multiplyMoney(m: Money, factor: number): Money {
  if (!Number.isInteger(factor) || factor < 0) {
    throw new Error(`multiplyMoney: factor must be a non-negative integer, got ${factor}`)
  }
  return { cents: m.cents * factor, currency: m.currency }
}

/**
 * What the customer is charged: unit price × quantity.
 *
 * Delivery is free, so this is the whole total — there is no shipping term. The
 * checkout route and the myPOS amount both come from here, and mark_order_paid
 * re-checks the settled amount against the same figure stored on the order.
 *
 * Takes the cents rather than a Plan so lib/data/pricing.ts can stay
 * dependency-free (see the note at the top of that file).
 */
export function orderTotal(unitPriceEurCents: number, quantity: number): Money {
  return multiplyMoney(eur(unitPriceEurCents), quantity)
}

// Intl.NumberFormat construction is expensive; build each one once.
const formatters = new Map<string, Intl.NumberFormat>()

function formatter(currency: Currency, whole: boolean): Intl.NumberFormat {
  const key = `${currency}:${whole}`
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.NumberFormat('bg-BG', {
      style: 'currency',
      currency,
      ...(whole ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
    })
    formatters.set(key, f)
  }
  return f
}

/**
 * Bulgarian convention, straight from ICU: comma decimal, symbol after the
 * number — "58,67 лв." and "30,00 €".
 *
 * `trimZeroCents` drops ".00" for round amounts, which is how the marketing
 * copy already reads ("30 €"). Use it for headline prices, not for totals a
 * customer will reconcile against a receipt.
 */
export function formatMoney(
  m: Money,
  opts?: { trimZeroCents?: boolean },
): string {
  const whole = Boolean(opts?.trimZeroCents) && m.cents % 100 === 0
  return formatter(m.currency, whole).format(m.cents / 100)
}

/**
 * Dual display for the changeover period: euro primary, lev in parentheses.
 * Mirrors the existing pricing card, so `both` can drop straight into copy.
 */
export function formatDual(
  m: Money,
  opts?: { trimZeroCents?: boolean },
): { eur: string; bgn: string; both: string } {
  const inEur = toEur(m)
  const inBgn = toBgn(inEur)
  const e = formatMoney(inEur, opts)
  const b = formatMoney(inBgn, opts)
  return { eur: e, bgn: b, both: `${e} (${b})` }
}

/**
 * Half-up, and explicitly away from zero for negatives — Math.round() breaks
 * ties toward +Infinity, so -0.5 would round to -0 instead of -1. Amounts here
 * are non-negative today, but refunds are coming.
 */
function roundHalfUp(n: number): number {
  return n < 0 ? -Math.round(-n) : Math.round(n)
}
