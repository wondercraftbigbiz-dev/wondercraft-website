// Validation rules shared by the browser and the API routes.
//
//   pnpm check:order

import assert from 'node:assert/strict'
import { VCity, vCity } from '../lib/bg.ts'
import { MAX_QUANTITY } from '../lib/data/pricing.ts'
import {
  LIMITS,
  hasErrors,
  normalizePhone,
  validateContact,
  validateDelivery,
  validateOrder,
  type DeliveryDraft,
} from '../lib/order/schema.ts'

// --- Phone normalization ----------------------------------------------------
for (const raw of [
  '0881234567',
  '+359881234567',
  '00359881234567',
  '359881234567',
  '088 123 4567',
  '088-123-4567',
  '(088) 123 4567',
  ' 0881234567 ',
]) {
  assert.equal(normalizePhone(raw), '+359881234567', `failed to normalize ${raw}`)
}
assert.equal(normalizePhone('0891234567'), '+359891234567')
assert.equal(normalizePhone('0871234567'), '+359871234567')

// Rejected: landlines (no Econt SMS), wrong length, junk.
for (const raw of [
  '',
  '029876543', // Sofia landline
  '0861234567', // 86 is not a mobile prefix
  '088123456', // too short
  '08812345678', // too long
  '+49881234567', // not Bulgarian
  'телефон',
]) {
  assert.equal(normalizePhone(raw), null, `should have rejected ${raw}`)
}

// --- Contact ----------------------------------------------------------------
const goodContact = {
  name: 'Иван Петров',
  phone: '0881234567',
  email: 'ivan@example.com',
  planId: 'standard',
  quantity: 1,
}
assert.equal(hasErrors(validateContact(goodContact)), false)

assert.match(validateContact({ ...goodContact, name: '' }).name!, /въведете име/)
assert.match(validateContact({ ...goodContact, name: '  ' }).name!, /въведете име/)
assert.match(validateContact({ ...goodContact, name: 'И' }).name!, /пълното/)
assert.match(validateContact({ ...goodContact, name: '123' }).name!, /пълното/)
assert.match(
  validateContact({ ...goodContact, name: 'и'.repeat(LIMITS.name + 1) }).name!,
  /до 100 символа/,
)
assert.match(validateContact({ ...goodContact, phone: '' }).phone!, /въведете телефон/)
assert.match(validateContact({ ...goodContact, phone: '029876543' }).phone!, /мобилен/)
assert.match(validateContact({ ...goodContact, planId: 'nope' }).model!, /изберете модел/)

// Email: required, because customers.email is NOT NULL and the confirmation
// goes there. Permissive on shape — it catches typos, not exotic addresses.
assert.match(validateContact({ ...goodContact, email: '' }).email!, /въведете имейл/)
assert.match(validateContact({ ...goodContact, email: '   ' }).email!, /въведете имейл/)
for (const bad of ['ivan', 'ivan@', '@example.com', 'ivan@example', 'a b@c.com']) {
  assert.ok(
    validateContact({ ...goodContact, email: bad }).email,
    `should have rejected email ${bad}`,
  )
}
for (const good of ['a@b.co', 'ivan.petrov+tag@sub.example.com']) {
  assert.equal(
    validateContact({ ...goodContact, email: good }).email,
    undefined,
    `should have accepted email ${good}`,
  )
}
assert.match(
  validateContact({ ...goodContact, email: `${'a'.repeat(250)}@b.co` }).email!,
  /до 254 символа/,
)

// Quantity: an integer within range. Anything else is a tampered or broken
// client, and the total is computed from it server-side.
for (const bad of [0, -1, 1.5, Number.NaN, MAX_QUANTITY + 1]) {
  assert.ok(
    validateContact({ ...goodContact, quantity: bad }).quantity,
    `should have rejected quantity ${bad}`,
  )
}
for (const good of [1, 2, MAX_QUANTITY]) {
  assert.equal(
    validateContact({ ...goodContact, quantity: good }).quantity,
    undefined,
    `should have accepted quantity ${good}`,
  )
}

// The distance-selling agreement is required only on the card path.
assert.match(
  validateContact({ ...goodContact, mode: 'pay', acceptTerms: false }).acceptTerms!,
  /общите условия/,
)
assert.equal(
  validateContact({ ...goodContact, mode: 'pay', acceptTerms: true }).acceptTerms,
  undefined,
)
assert.equal(
  validateContact({ ...goodContact, mode: 'contact', acceptTerms: false }).acceptTerms,
  undefined,
  'the call-me-back path must not demand the terms box',
)

assert.match(
  validateContact({ ...goodContact, printName: 'а'.repeat(31) }).printName!,
  /до 30 символа/,
)
assert.match(
  validateContact({ ...goodContact, printName: 'Иван\nПетров' }).printName!,
  /един ред/,
)
assert.equal(
  validateContact({ ...goodContact, printName: '' }).printName,
  undefined,
  'печат is optional',
)

// --- Delivery ---------------------------------------------------------------
const office: DeliveryDraft = { type: 'office', cityId: 41, officeCode: '1010' }
assert.equal(hasErrors(validateDelivery(office)), false)

// A typed city is not a chosen city — Econt needs the id.
assert.match(validateDelivery({ ...office, cityId: null }).city!, /от списъка/)
assert.match(validateDelivery({ ...office, officeCode: null }).officeCode!, /офис/)
assert.match(
  validateDelivery({ type: 'aps', cityId: 41, officeCode: null }).officeCode!,
  /автомат/,
)

const address: DeliveryDraft = {
  type: 'address',
  cityId: 41,
  officeCode: null,
  street: 'ул. Раковски',
  streetNum: '96',
}
assert.equal(hasErrors(validateDelivery(address)), false)
assert.match(validateDelivery({ ...address, street: '' }).street!, /улица/)
assert.match(validateDelivery({ ...address, streetNum: '' }).streetNum!, /номер/)
assert.match(
  validateDelivery({ ...address, streetNum: '1'.repeat(11) }).streetNum!,
  /до 10 символа/,
)
// An address does not need an office code.
assert.equal(validateDelivery(address).officeCode, undefined)
// A bad type is caught before anything else is examined.
assert.match(
  validateDelivery({ ...office, type: 'pigeon' as DeliveryDraft['type'] }).deliveryType!,
  /начин на доставка/,
)

// --- Whole order ------------------------------------------------------------
const ok = validateOrder({ ...goodContact, delivery: office })
assert.equal(hasErrors(ok.errors), false)
assert.ok(ok.value)
assert.equal(ok.value.phone, '+359881234567', 'phone must come back normalized')
assert.equal(ok.value.name, 'Иван Петров')
assert.equal(ok.value.planId, 'standard')
assert.equal(ok.value.printName, null, 'blank optional fields normalize to null')
assert.equal(ok.value.delivery.cityId, 41)
assert.equal(ok.value.email, 'ivan@example.com', 'email must come back lowercased')
assert.equal(
  validateOrder({
    ...goodContact,
    email: '  IVAN@Example.COM ',
    delivery: office,
  }).value?.email,
  'ivan@example.com',
)
assert.equal(ok.value.quantity, 1)
// Mode defaults to the non-charging path when absent, so a malformed request can
// never accidentally be treated as authorised to take a payment.
assert.equal(ok.value.mode, 'contact')
assert.equal(
  validateOrder({ ...goodContact, mode: 'pay', acceptTerms: true, delivery: office })
    .value?.mode,
  'pay',
)
assert.equal(ok.value.marketingConsent, false, 'consent must be opt-in')

// Whitespace-only optional fields are null, not empty strings.
const trimmed = validateOrder({
  ...goodContact,
  printName: '  ',
  message: '\n',
  delivery: office,
})
assert.equal(trimmed.value?.printName, null)
assert.equal(trimmed.value?.message, null)

// Contact and delivery problems surface together, so the customer fixes the
// whole form in one pass rather than one field per submit.
const both = validateOrder({
  ...goodContact,
  name: '',
  delivery: { ...office, officeCode: null },
})
assert.ok(both.errors.name && both.errors.officeCode)
assert.equal(both.value, undefined, 'no value when invalid')

// --- Bulgarian preposition agreement ---------------------------------------
// "в Варна" is unpronounceable; the preposition becomes "във" before в and ф.
assert.equal(vCity('София'), 'в София')
assert.equal(vCity('Варна'), 'във Варна')
assert.equal(vCity('Велико Търново'), 'във Велико Търново')
assert.equal(vCity('Фотиново'), 'във Фотиново')
assert.equal(VCity('Варна'), 'Във Варна')
assert.equal(VCity('Пловдив'), 'В Пловдив')

console.log('check-order: all assertions passed')
