// Guards the numbers a human will check first: that the euro prices in
// lib/data/pricing.ts still render as the lev strings shown on the site.
//
//   node --experimental-strip-types scripts/check-money.ts
//
// Node 22 strips types natively. No test runner, no dependencies — this is a
// script, not a suite, and it runs in well under a second.

import assert from 'node:assert/strict'
import {
  BGN_PER_EUR,
  addMoney,
  bgn,
  eur,
  formatDual,
  formatMoney,
  toBgn,
  toEur,
} from '../lib/money.ts'
import {
  plans,
  startingPrice,
  startingPriceEurCents,
} from '../lib/data/pricing.ts'

/**
 * ICU separates the number from the currency symbol with a non-breaking space
 * (U+00A0). That is correct typography and formatMoney keeps it — but the
 * literals in pricing.ts are hand-typed with plain spaces, so every comparison
 * here normalizes the space kind.
 */
function money(m: Parameters<typeof formatMoney>[0], trim = false): string {
  return formatMoney(m, { trimZeroCents: trim }).replace(/ /g, ' ')
}

// --- The rate itself --------------------------------------------------------
assert.equal(BGN_PER_EUR, 1.95583)

// --- Formatting matches the site's existing copy ----------------------------
assert.equal(money(eur(3500)), '35,00 €')
assert.equal(money(eur(3500), true), '35 €')
assert.equal(money(eur(4500), true), '45 €')
assert.equal(money(bgn(6845)), '68,45 лв.')
assert.equal(money(bgn(8801)), '88,01 лв.')
// trimZeroCents must NOT trim a non-round amount.
assert.equal(money(bgn(6845), true), '68,45 лв.')

// --- Conversion -------------------------------------------------------------
assert.equal(toBgn(eur(3500)).cents, 6845) // 35 × 1.95583 = 68.45405
assert.equal(toBgn(eur(4500)).cents, 8801) // 45 × 1.95583 = 88.01235
assert.equal(toBgn(bgn(1234)).cents, 1234) // no-op when already BGN
assert.equal(toEur(eur(1234)).cents, 1234)

// Round-tripping EUR → BGN → EUR must land back on the same cent for every
// amount we could plausibly charge (up to 1000 €).
for (let c = 0; c <= 100_000; c += 7) {
  assert.equal(
    toEur(toBgn(eur(c))).cents,
    c,
    `round-trip failed at ${c} eurocents`,
  )
}

// --- Arithmetic -------------------------------------------------------------
assert.equal(addMoney(eur(3500), eur(690)).cents, 4190)
assert.throws(
  () => addMoney(eur(100), bgn(100)),
  /currency mismatch/,
  'adding across currencies must throw, not silently coerce',
)

// --- Dual display -----------------------------------------------------------
assert.equal(
  formatDual(eur(3500), { trimZeroCents: true }).both.replace(/ /g, ' '),
  '35 € (68,45 лв.)',
)
assert.equal(formatDual(bgn(6845)).eur.replace(/ /g, ' '), '35,00 €')

// --- pricing.ts display strings agree with the authoritative cents ----------
for (const plan of plans) {
  const price = eur(plan.priceEurCents)
  assert.equal(
    money(price, true),
    plan.euro,
    `plan "${plan.id}": euro string "${plan.euro}" disagrees with priceEurCents ${plan.priceEurCents}`,
  )
  assert.equal(
    money(toBgn(price)),
    plan.lev,
    `plan "${plan.id}": lev string "${plan.lev}" disagrees with priceEurCents ${plan.priceEurCents}`,
  )
}

const cheapest = Math.min(...plans.map((p) => p.priceEurCents))
assert.equal(startingPriceEurCents, cheapest)
assert.equal(money(eur(startingPriceEurCents), true), startingPrice.euro)
assert.equal(money(toBgn(eur(startingPriceEurCents))), startingPrice.lev)

console.log('check-money: all assertions passed')
