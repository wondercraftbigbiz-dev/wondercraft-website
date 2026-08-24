// Validation rules shared by the browser and the API routes.
//
//   pnpm check:order

import assert from 'node:assert/strict'
import { VCity, vCity } from '../lib/bg.ts'
import {
  LIMITS,
  hasErrors,
  normalizeEmail,
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

// --- Email normalization ----------------------------------------------------
assert.equal(normalizeEmail('ivan@example.com'), 'ivan@example.com')
// Canonicalized: mailboxes are not case-sensitive anywhere in practice.
assert.equal(normalizeEmail('  IVAN@Example.COM '), 'ivan@example.com')
assert.equal(normalizeEmail('ivan.petrov+поръчка@example.co.uk'), 'ivan.petrov+поръчка@example.co.uk')
assert.equal(normalizeEmail('иван@example.bg'), 'иван@example.bg')

for (const raw of [
  '',
  'ivan',
  'ivan@',
  '@example.com',
  'ivan@example', // no dot in the domain
  'ivan@example..com', // empty label
  'ivan @example.com',
  'ivan@exa mple.com',
  'ivan@@example.com',
  `${'и'.repeat(LIMITS.email)}@example.com`, // over the length cap
]) {
  assert.equal(normalizeEmail(raw), null, `should have rejected ${raw}`)
}

// --- Contact ----------------------------------------------------------------
const goodContact = {
  firstName: 'Иван',
  lastName: 'Петров',
  email: 'ivan@example.com',
  phone: '0881234567',
  planId: 'standard',
}
assert.equal(hasErrors(validateContact(goodContact)), false)

// Both parts of the name are required — a first name alone is not enough.
assert.match(validateContact({ ...goodContact, firstName: '' }).firstName!, /въведете име/)
assert.match(validateContact({ ...goodContact, firstName: '  ' }).firstName!, /въведете име/)
assert.match(validateContact({ ...goodContact, lastName: '' }).lastName!, /въведете фамилия/)
assert.match(validateContact({ ...goodContact, lastName: '   ' }).lastName!, /въведете фамилия/)

// A lone initial, digits or symbols are not a name.
assert.match(validateContact({ ...goodContact, firstName: 'И' }).firstName!, /валидно име/)
assert.match(validateContact({ ...goodContact, firstName: '123' }).firstName!, /валидно име/)
assert.match(validateContact({ ...goodContact, firstName: 'Иван1' }).firstName!, /валидно име/)
assert.match(validateContact({ ...goodContact, lastName: '!!' }).lastName!, /валидна фамилия/)

// Real names keep their punctuation, in either script.
for (const name of ['Ана-Мария', "О'Брайън", 'Ван дер Берг', 'Jean-Luc', 'Иван']) {
  assert.equal(
    validateContact({ ...goodContact, firstName: name }).firstName,
    undefined,
    `should have accepted ${name}`,
  )
}

assert.match(
  validateContact({ ...goodContact, firstName: 'и'.repeat(LIMITS.firstName + 1) }).firstName!,
  /до 50 символа/,
)
assert.match(
  validateContact({ ...goodContact, lastName: 'и'.repeat(LIMITS.lastName + 1) }).lastName!,
  /до 50 символа/,
)

assert.match(validateContact({ ...goodContact, email: '' }).email!, /въведете имейл/)
assert.match(validateContact({ ...goodContact, email: 'ivan@example' }).email!, /валиден имейл/)

assert.match(validateContact({ ...goodContact, phone: '' }).phone!, /въведете телефон/)
assert.match(validateContact({ ...goodContact, phone: '029876543' }).phone!, /мобилен/)
assert.match(validateContact({ ...goodContact, planId: 'nope' }).model!, /изберете модел/)

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
assert.equal(ok.value.email, 'ivan@example.com')
assert.equal(ok.value.firstName, 'Иван')
assert.equal(ok.value.lastName, 'Петров')
// Econt and the order log both want one full name, so it is derived once here.
assert.equal(ok.value.name, 'Иван Петров')
assert.equal(ok.value.planId, 'standard')
assert.equal(ok.value.printName, null, 'blank optional fields normalize to null')
assert.equal(ok.value.delivery.cityId, 41)

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
  lastName: '',
  delivery: { ...office, officeCode: null },
})
assert.ok(both.errors.lastName && both.errors.officeCode)
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
