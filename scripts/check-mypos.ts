// myPOS purchase construction: field names, their ORDER, the amount arithmetic,
// and that the signature covers every field.
//
// Runs against a throwaway RSA keypair generated here, so it needs no myPOS
// account and no network. It proves the request we build is internally
// consistent and tamper-evident — it cannot prove the field NAMES match myPOS's
// spec, which is reconstructed from their SDKs (developers.mypos.com is not
// reachable from this environment). If myPOS ever rejects a request with a
// signature error, the ordered list in lib/mypos/purchase.ts is the thing to
// check first, and this file is where to encode whatever the spec says.
//
//   pnpm check:mypos

import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { getMyposConfig, resetMyposConfigCache } from '../lib/mypos/config.ts'
import { buildPurchaseRequest } from '../lib/mypos/purchase.ts'
import { verifyFields } from '../lib/mypos/sign.ts'

// The public half doubles as the "API public key" so the same keypair can both
// sign and verify inside this test. getMyposConfig() reads the environment
// lazily, so setting these after import is fine.
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
process.env.MYPOS_ENV = 'test'
process.env.MYPOS_SID = '000000000000010'
process.env.MYPOS_WALLET_NUMBER = '61938166610'
process.env.MYPOS_KEY_INDEX = '1'
process.env.NEXT_PUBLIC_SITE_URL = 'https://wondercraft.bg'
process.env.MYPOS_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
process.env.MYPOS_API_PUBLIC_KEY = publicKey.export({ type: 'spki', format: 'pem' }).toString()
resetMyposConfigCache()

const req = buildPurchaseRequest({
  orderId: 'WC-TEST123ABCD',
  items: [
    {
      article: 'Стандартен — картонена къщичка Wondercraft',
      quantity: 3,
      priceEur: 30,
    },
  ],
  customer: {
    email: 'ivan@example.com',
    phone: '+359881234567',
    firstNames: 'Иван',
    familyName: 'Петров',
    city: 'София',
    zipCode: '1000',
  },
  note: 'Wondercraft WC-TEST123ABCD',
})

const names: string[] = req.fields.map(([n]) => n)
const get = (name: string): string =>
  req.fields.find(([k]) => k === name)?.[1] ?? ''

// --- Envelope ---------------------------------------------------------------
assert.equal(req.action, 'https://www.mypos.eu/vmp/checkout-test')
assert.equal(names[0], 'IPCmethod')
assert.equal(get('IPCmethod'), 'IPCPurchase')
assert.equal(names[names.length - 1], 'Signature', 'Signature must be last')
assert.equal(names.filter((n) => n === 'Signature').length, 1)
assert.equal(new Set(names).size, names.length, 'no duplicate field names')

// --- Money ------------------------------------------------------------------
// Two decimals with a dot, and the line total must equal price x quantity.
assert.equal(get('Amount'), '90.00')
assert.equal(get('Currency'), 'EUR')
assert.equal(get('CartItems'), '1')
assert.equal(get('Quantity_1'), '3')
assert.equal(get('Price_1'), '30.00')
assert.equal(get('Amount_1'), '90.00')
assert.equal(get('Currency_1'), 'EUR')

// --- Customer and order -----------------------------------------------------
assert.equal(get('OrderID'), 'WC-TEST123ABCD')
assert.equal(get('customeremail'), 'ivan@example.com')
assert.equal(get('customerphone'), '+359881234567')
assert.equal(get('customerfirstnames'), 'Иван')
assert.equal(get('customerfamilyname'), 'Петров')
assert.equal(get('customercity'), 'София')
assert.equal(get('customerzipcode'), '1000')
assert.equal(get('customercountry'), 'BGR')

// We never want myPOS to store a card for us.
assert.equal(get('CardTokenRequest'), '0')

// --- Callback URLs ----------------------------------------------------------
// Absolute and https: myPOS reverses transactions sent to a non-SSL URL_Notify.
for (const [field, path] of [
  ['URL_OK', '/order/success'],
  ['URL_Cancel', '/order/cancel'],
  ['URL_Notify', '/api/mypos/notify'],
] as const) {
  const value = get(field)
  assert.ok(
    value.startsWith(`https://wondercraft.bg${path}`),
    `${field} should be an absolute https URL at ${path}, got ${value}`,
  )
}

// --- Signature --------------------------------------------------------------
const config = getMyposConfig()
const covered = req.fields.filter(([n]) => n !== 'Signature')
assert.equal(
  verifyFields(covered, get('Signature'), config.apiPublicKey),
  true,
  'the signature must verify over every field except itself',
)

// Tampering with the amount after signing must invalidate it. This is the
// property that makes the hidden-form POST safe to hand to the browser.
const tampered = covered.map(([n, v]): readonly [string, string] =>
  n === 'Amount' ? [n, '1.00'] : [n, v],
)
assert.equal(
  verifyFields(tampered, get('Signature'), config.apiPublicKey),
  false,
  'a tampered amount must fail verification',
)

// Reordering must also invalidate it — order is part of the protocol.
const reordered = [covered[1], covered[0], ...covered.slice(2)]
assert.equal(
  verifyFields(reordered, get('Signature'), config.apiPublicKey),
  false,
  'reordered fields must fail verification',
)

// --- Multi-line cart --------------------------------------------------------
const two = buildPurchaseRequest({
  orderId: 'WC-TWO',
  items: [
    { article: 'A', quantity: 1, priceEur: 30 },
    { article: 'B', quantity: 2, priceEur: 40 },
  ],
  customer: {
    email: 'a@b.co',
    phone: '+359881234567',
    firstNames: 'A',
    familyName: 'B',
  },
})
const twoNames: string[] = two.fields.map(([n]) => n)
const twoGet = (name: string): string =>
  two.fields.find(([k]) => k === name)?.[1] ?? ''

assert.equal(twoGet('CartItems'), '2')
assert.ok(twoNames.includes('Article_2'), 'cart lines are 1-indexed and contiguous')
assert.equal(twoGet('Amount_2'), '80.00')
assert.equal(twoGet('Amount'), '110.00', '30 + 2 x 40')

// An empty cart is a programming error, not a zero-value order.
assert.throws(
  () =>
    buildPurchaseRequest({
      orderId: 'WC-EMPTY',
      items: [],
      customer: {
        email: 'a@b.co',
        phone: '+359881234567',
        firstNames: 'A',
        familyName: 'B',
      },
    }),
  'an empty cart must throw',
)

console.log('check-mypos: all purchase-field assertions passed')
