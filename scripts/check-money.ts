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
  orderTotal,
  toBgn,
  toEur,
} from '../lib/money.ts'
import {
  plans,
  stackParcels,
  startingPrice,
  startingPriceEurCents,
  type Parcel,
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

// --- Parcel stacking --------------------------------------------------------
// Houses ship flat-packed, so N of them stack: weight scales, and only the
// thinnest dimension grows. Scaling all three would overstate volumetric weight
// by roughly N^3 and quote an absurd delivery price.
{
  const box: Parcel = { weightKg: 1.4, lengthCm: 80, widthCm: 60, heightCm: 8 }

  assert.deepEqual(stackParcels(box, 1), box, 'a single parcel is unchanged')

  const three = stackParcels(box, 3)
  assert.equal(three.weightKg, 4.2, 'weight scales with count')
  assert.equal(three.heightCm, 24, 'the thinnest dimension is the one that grows')
  assert.equal(three.lengthCm, 80, 'footprint length is unchanged')
  assert.equal(three.widthCm, 60, 'footprint width is unchanged')

  // Whichever dimension is thinnest, that is the one that grows.
  const tall: Parcel = { weightKg: 2, lengthCm: 10, widthCm: 40, heightCm: 50 }
  const stackedTall = stackParcels(tall, 2)
  assert.equal(stackedTall.lengthCm, 20)
  assert.equal(stackedTall.widthCm, 40)
  assert.equal(stackedTall.heightCm, 50)

  // Volume must grow linearly, not cubically.
  const vol = (p: Parcel) => p.lengthCm * p.widthCm * p.heightCm
  assert.equal(vol(three), vol(box) * 3, 'volume is linear in count')

  for (const bad of [0, -1, 2.5]) {
    assert.throws(() => stackParcels(box, bad), `should reject count ${bad}`)
  }
}

// --- Order total ------------------------------------------------------------
// Delivery is free, so the total is unit x quantity and nothing else.
{
  assert.equal(orderTotal(3000, 1).cents, 3000)
  assert.equal(orderTotal(3000, 3).cents, 9000)
  assert.equal(orderTotal(4000, 10).cents, 40000)
  assert.equal(orderTotal(3000, 1).currency, 'EUR')
  // Integer cents throughout: no float dust at any quantity.
  for (let q = 1; q <= 10; q += 1) {
    assert.ok(Number.isInteger(orderTotal(4000, q).cents), `q=${q} must stay integral`)
  }
  assert.throws(() => orderTotal(3000, 1.5), 'fractional quantity must throw')
  assert.throws(() => orderTotal(3000, -1), 'negative quantity must throw')
}

console.log('check-money: parcel and order-total assertions passed')
