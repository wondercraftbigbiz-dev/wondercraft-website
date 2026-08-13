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
assert.equal(money(eur(3000)), '30,00 €')
assert.equal(money(eur(3000), true), '30 €')
assert.equal(money(eur(4000), true), '40 €')
assert.equal(money(bgn(5867)), '58,67 лв.')
assert.equal(money(bgn(7823)), '78,23 лв.')
// trimZeroCents must NOT trim a non-round amount.
assert.equal(money(bgn(5867), true), '58,67 лв.')

// --- Conversion -------------------------------------------------------------
assert.equal(toBgn(eur(3000)).cents, 5867) // 30 × 1.95583 = 58.6749
assert.equal(toBgn(eur(4000)).cents, 7823) // 40 × 1.95583 = 78.2332
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
assert.equal(addMoney(eur(3000), eur(690)).cents, 3690)
assert.throws(
  () => addMoney(eur(100), bgn(100)),
  /currency mismatch/,
  'adding across currencies must throw, not silently coerce',
)

// --- Dual display -----------------------------------------------------------
assert.equal(
  formatDual(eur(3000), { trimZeroCents: true }).both.replace(/ /g, ' '),
  '30 € (58,67 лв.)',
)
assert.equal(formatDual(bgn(5867)).eur.replace(/ /g, ' '), '30,00 €')

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
