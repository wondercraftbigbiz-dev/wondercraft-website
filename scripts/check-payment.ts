// Everything about the payment path that can be asserted without a network or a
// Stripe account: what reaches Stripe's metadata, how an amount is derived, and
// whether the webhook parser survives the shapes Stripe actually sends.
//
//   pnpm check:payment

import assert from 'node:assert/strict'
import {
  METADATA_LIMITS,
  PII_KEYS,
  buildIntentMetadata,
  hashQuoteId,
} from '../lib/payments/metadata.ts'
import {
  readChargeRefund,
  readIntentEvent,
} from '../lib/payments/webhook-parse.ts'
import { addMoney, eur, toBgn } from '../lib/money.ts'
import { plans } from '../lib/data/pricing.ts'

// A fixture whose personal data is distinctive enough to grep for.
//
// The values are deliberately unusual. A street number of '42' would appear as a
// substring of the order ref 'WC-1042' and fail this check for no reason, which
// says more about the fixture than the code: a substring search needs values
// that cannot collide with a reference, an amount, or a city id.
const PII = {
  name: 'Иван Петров',
  phone: '+359889773311',
  email: 'ivan@example.com',
  street: 'Оборище',
  streetNum: '8817',
}

// --- Metadata ---------------------------------------------------------------
// The quote key embeds the destination, which for address delivery means a
// street name and a house number. This is the exact shape lib/econt/shipping.ts
// produces.
const addressQuoteId = `standard|41|address|${PII.street}|${PII.streetNum}||`

const metadata = buildIntentMetadata({
  orderRef: 'WC-1042',
  attemptId: '6f1c2a5e-0000-4000-8000-000000000000',
  planId: 'standard',
  sku: 'WC-STD-01',
  quoteId: addressQuoteId,
  cityId: 41,
  deliveryType: 'address',
  officeCode: null,
  productEurCents: 3000,
  shippingEurCents: 590,
})

// Stripe's hard limits. Exceeding any of them rejects the whole intent.
assert.ok(
  Object.keys(metadata).length <= METADATA_LIMITS.keys,
  'too many metadata keys',
)
for (const [key, value] of Object.entries(metadata)) {
  assert.ok(key.length <= METADATA_LIMITS.keyChars, `metadata key too long: ${key}`)
  assert.ok(
    value.length <= METADATA_LIMITS.valueChars,
    `metadata value too long: ${key}`,
  )
  assert.equal(typeof value, 'string', `metadata values must be strings: ${key}`)
}

// No personal data, by key name...
for (const banned of PII_KEYS) {
  assert.ok(!(banned in metadata), `metadata must not carry ${banned}`)
}

// ...and, more importantly, by value. A key denylist alone would not have caught
// the quote id smuggling a street address through, which is the whole reason
// quoteId is hashed rather than sent.
const serialized = JSON.stringify(metadata)
for (const [label, secret] of Object.entries(PII)) {
  assert.ok(
    !serialized.includes(secret),
    `metadata leaks ${label} (${secret}) — check buildIntentMetadata`,
  )
}
assert.ok(
  !serialized.includes(addressQuoteId),
  'the raw quote id must never reach Stripe: it contains the delivery address',
)
assert.equal(metadata.quoteIdHash, hashQuoteId(addressQuoteId))
assert.equal(metadata.quoteIdHash.length, 16)

// The handles the webhook and a human operator actually need.
assert.equal(metadata.orderRef, 'WC-1042')
assert.equal(metadata.sku, 'WC-STD-01')
assert.equal(metadata.productEurCents, '3000')
assert.equal(metadata.shippingEurCents, '590')

// Office delivery carries the office code; address delivery has none to carry.
const officeMeta = buildIntentMetadata({
  orderRef: 'WC-1043',
  attemptId: 'a',
  planId: 'custom',
  sku: 'WC-CUS-01',
  quoteId: null,
  cityId: 41,
  deliveryType: 'office',
  officeCode: '1234',
  productEurCents: 4000,
  shippingEurCents: 500,
})
assert.equal(officeMeta.officeCode, '1234')
assert.ok(!('quoteIdHash' in officeMeta), 'no quote id means no hash')

// --- Amounts ----------------------------------------------------------------
// Stripe takes an integer in the minor unit, which is exactly what Money.cents
// already is. A float here would undo the entire reason lib/money.ts exists.
for (const plan of plans) {
  for (const shippingCents of [0, 590, 1234]) {
    const total = addMoney(eur(plan.priceEurCents), eur(shippingCents))
    assert.ok(Number.isInteger(total.cents), 'Stripe amount must be an integer')
    assert.ok(total.cents > 0, 'Stripe amount must be positive')
    assert.equal(total.cents, plan.priceEurCents + shippingCents)
    assert.equal(total.currency, 'EUR')
  }
}

// The lev mirror, converted ONCE from the euro total. 35,90 x 1.95583 =
// 70.2143..., which rounds half-up to 70,21 лв. Converting the product and the
// delivery separately and adding them would round twice and can land a stotinka
// out; this is the assertion that keeps that from creeping back in.
const standard = plans.find((p) => p.id === 'standard')!
assert.equal(toBgn(eur(standard.priceEurCents + 590)).cents, 7021)

// A case where rounding twice genuinely diverges: 30,00 + 5,55 converts to
// 69,53 лв. as one sum, but 58,67 + 10,85 = 69,52 лв. converted separately. One
// stotinka, and it is the difference between a receipt that reconciles and one
// that does not. 5,90 happens not to expose this, which is exactly why it is a
// poor case to assert against.
assert.equal(toBgn(eur(standard.priceEurCents + 555)).cents, 6953)
assert.equal(
  toBgn(eur(standard.priceEurCents)).cents + toBgn(eur(555)).cents,
  6952,
  'converting the parts separately must round twice and land a stotinka low',
)

// --- Webhook parsing --------------------------------------------------------
// Signature verification proves origin, not shape. Every field below is one
// Stripe genuinely varies, and none of them may throw.
const succeeded = readIntentEvent({
  id: 'pi_123',
  amount: 3590,
  amount_received: 3590,
  currency: 'eur',
  metadata: { orderRef: 'WC-1042', attemptId: 'abc' },
})
assert.equal(succeeded?.intentId, 'pi_123')
assert.equal(succeeded?.amountCents, 3590)
assert.equal(succeeded?.currency, 'EUR', 'currency must be normalized to compare')
assert.equal(succeeded?.orderRef, 'WC-1042')

// amount_received is null on some failures; fall back to the intended amount so
// a mismatch check still has something to compare against.
const nullReceived = readIntentEvent({
  id: 'pi_124',
  amount: 3590,
  amount_received: null,
  currency: 'eur',
  metadata: {},
})
assert.equal(nullReceived?.amountCents, 3590)
assert.equal(nullReceived?.orderRef, null, 'missing metadata is null, not undefined')

const failed = readIntentEvent({
  id: 'pi_125',
  amount: 3590,
  currency: 'eur',
  metadata: {},
  last_payment_error: { code: 'card_declined', message: 'Your card was declined.' },
})
assert.equal(failed?.failureCode, 'card_declined')

// Garbage must return null rather than throw: a 500 here makes Stripe retry a
// malformed event forever.
for (const junk of [null, undefined, 42, 'pi_1', [], {}, { id: '' }, { id: 3 }]) {
  assert.doesNotThrow(() => readIntentEvent(junk))
  assert.equal(readIntentEvent(junk), null, `should have rejected ${JSON.stringify(junk)}`)
}

// payment_intent arrives as a bare id, or expanded, depending on the endpoint.
assert.equal(
  readChargeRefund({ payment_intent: 'pi_200', amount_refunded: 3590 })?.intentId,
  'pi_200',
)
assert.equal(
  readChargeRefund({ payment_intent: { id: 'pi_201' }, amount_refunded: 100 })?.intentId,
  'pi_201',
)
assert.equal(
  readChargeRefund({ payment_intent: 'pi_202' })?.refundedCents,
  0,
  'a missing refund amount is 0, not NaN',
)
for (const junk of [null, {}, { payment_intent: null }, { payment_intent: 7 }]) {
  assert.doesNotThrow(() => readChargeRefund(junk))
  assert.equal(readChargeRefund(junk), null)
}

console.log('check:payment OK')
