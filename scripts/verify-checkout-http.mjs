/**
 * Drives the checkout and notify endpoints over real HTTP against a running
 * dev server.
 *
 * Signs notifications with a throwaway keypair, so it needs no myPOS account.
 * The server must be started with the matching key — see the printed env block,
 * or run scripts/verify-checkout-http.sh which wires it up for you.
 *
 *   BASE_URL=http://127.0.0.1:3100 node scripts/verify-checkout-http.mjs
 *
 * Cases that need the Supabase service role key are skipped (and reported as
 * skipped) when SUPABASE_SERVICE_ROLE_KEY is absent.
 */
import { readFileSync } from 'node:fs'
import { createPrivateKey, sign } from 'node:crypto'

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3100'
const KEY_PATH = process.env.TEST_PRIVATE_KEY_PATH
const SID = process.env.MYPOS_SID ?? '000000000000010'
const hasDb = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())

let failures = 0
let skipped = 0

function check(label, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  if (!pass) failures += 1
  console.log(
    `${pass ? 'PASS' : 'FAIL'}  ${label}` +
      (pass ? '' : `\n        got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`),
  )
}

function skip(label, why) {
  skipped += 1
  console.log(`SKIP  ${label}  (${why})`)
}

// ── notification signing, mirroring lib/mypos/sign.ts ────────────────────────
const privateKey = KEY_PATH
  ? createPrivateKey(readFileSync(KEY_PATH, 'utf8'))
  : null

function signNotify(pairs) {
  const base = Buffer.from(pairs.map(([, v]) => v).join('-'), 'utf8').toString('base64')
  return sign('sha256', Buffer.from(base, 'utf8'), privateKey).toString('base64')
}

function encode(pairs) {
  return pairs
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
}

function notifyBody({ orderId, amount, currency = 'EUR', sid = SID, trnref = 'TRN-TEST-1' }) {
  const pairs = [
    ['IPCmethod', 'IPCPurchaseNotify'],
    ['IPCVersion', '1.4'],
    ['SID', sid],
    ['Amount', amount],
    ['Currency', currency],
    ['OrderID', orderId],
    ['IPC_Trnref', trnref],
    ['RequestSTAN', '000123'],
    ['RequestDateTime', '2026-08-13T09:00:00'],
  ]
  return encode([...pairs, ['Signature', signNotify(pairs)]])
}

async function postForm(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  return { status: res.status, text: (await res.text()).trim() }
}

async function postJson(path, payload, headers = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* non-JSON response */
  }
  return { status: res.status, json, text }
}

const validOrder = {
  mode: 'contact',
  planId: 'standard',
  quantity: 2,
  name: 'Иван Петров',
  email: 'ivan@example.com',
  phone: '+359888123456',
  city: 'София, офис Еконт „Младост“',
  acceptTerms: true,
  marketingConsent: false,
}

console.log(`Target: ${BASE_URL}\n`)

// ── /api/checkout validation ────────────────────────────────────────────────
console.log('— /api/checkout validation —')

{
  const res = await fetch(`${BASE_URL}/api/checkout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: 'not json',
  })
  check('malformed JSON → 400 invalid_json', res.status, 400)
}

{
  const { status, json } = await postJson('/api/checkout', {})
  check('empty body → 400', status, 400)
  check('empty body → validation error', json?.error, 'validation')
  // An empty body defaults mode to 'pay', so the terms box is required too, and
  // an absent quantity is rejected rather than silently assumed to be 1.
  check(
    'empty body flags every required field',
    Object.keys(json?.errors ?? {}).sort(),
    ['acceptTerms', 'city', 'email', 'name', 'phone', 'planId', 'quantity'],
  )
}

{
  const { json } = await postJson('/api/checkout', { ...validOrder, email: 'nope' })
  check('bad email flagged', Boolean(json?.errors?.email), true)
}

{
  const { json } = await postJson('/api/checkout', { ...validOrder, phone: '12' })
  check('short phone flagged', Boolean(json?.errors?.phone), true)
}

{
  const { json } = await postJson('/api/checkout', { ...validOrder, quantity: 999 })
  check('out-of-range quantity flagged', Boolean(json?.errors?.quantity), true)
}

{
  const { json } = await postJson('/api/checkout', { ...validOrder, quantity: 1.5 })
  check('fractional quantity flagged', Boolean(json?.errors?.quantity), true)
}

{
  const { json } = await postJson('/api/checkout', { ...validOrder, planId: 'free' })
  check('unknown plan flagged', Boolean(json?.errors?.planId), true)
}

{
  const { json } = await postJson('/api/checkout', {
    ...validOrder,
    mode: 'pay',
    acceptTerms: false,
  })
  check('pay mode requires terms', Boolean(json?.errors?.acceptTerms), true)
}

{
  const { json } = await postJson('/api/checkout', {
    ...validOrder,
    mode: 'contact',
    acceptTerms: false,
  })
  check(
    'contact mode does not require terms',
    Boolean(json?.errors?.acceptTerms),
    false,
  )
}

// A client-supplied price must be ignored outright.
{
  const { status, json } = await postJson('/api/checkout', {
    ...validOrder,
    mode: 'pay',
    priceEur: 0.01,
    totalEur: 0.01,
    amount: 0.01,
  })
  if (hasDb) {
    check('injected price does not 200 with a bogus amount', status !== 200 || json?.totalEur, 60)
  } else {
    // Without a DB the request cannot complete, but it must not fail as a
    // validation error — proving the injected fields were simply ignored.
    check('injected price fields are ignored, not validated', json?.error !== 'validation', true)
  }
}

// ── /api/mypos/notify ───────────────────────────────────────────────────────
console.log('\n— /api/mypos/notify —')

{
  const res = await fetch(`${BASE_URL}/api/mypos/notify`)
  check('GET → 405', res.status, 405)
}

{
  const { status, text } = await postForm('/api/mypos/notify', 'Signature=garbage&OrderID=WC-1')
  check('garbage signature → 400', status, 400)
  check('garbage signature does NOT return OK', text, 'invalid signature')
}

{
  const { status, text } = await postForm('/api/mypos/notify', 'OrderID=WC-1&Amount=30')
  check('missing signature → 400', status, 400)
  check('missing signature does NOT return OK', text !== 'OK', true)
}

if (!privateKey) {
  skip('signed-notification cases', 'TEST_PRIVATE_KEY_PATH not set')
} else {
  {
    // Valid signature, but a store id that is not ours.
    const { status, text } = await postForm(
      '/api/mypos/notify',
      notifyBody({ orderId: 'WC-DOESNOTEXIST', amount: '30.00', sid: '999999999999999' }),
    )
    check('valid signature, wrong SID → 400', status, 400)
    check('wrong SID does NOT return OK', text, 'unknown store')
  }

  {
    // Tamper after signing: recompute nothing, just flip the amount.
    const signed = notifyBody({ orderId: 'WC-TAMPER', amount: '30.00' })
    const tampered = signed.replace('Amount=30.00', 'Amount=1.00')
    const { status, text } = await postForm('/api/mypos/notify', tampered)
    check('amount tampered after signing → 400', status, 400)
    check('tampered payload does NOT return OK', text, 'invalid signature')
  }

  {
    // Field reordered after signing must also fail.
    const pairs = [
      ['IPCmethod', 'IPCPurchaseNotify'],
      ['SID', SID],
      ['Amount', '30.00'],
      ['Currency', 'EUR'],
      ['OrderID', 'WC-REORDER'],
    ]
    const signature = signNotify(pairs)
    const reordered = encode([pairs[1], pairs[0], ...pairs.slice(2), ['Signature', signature]])
    const { status } = await postForm('/api/mypos/notify', reordered)
    check('reordered fields → 400', status, 400)
  }

  if (!hasDb) {
    skip('settlement cases', 'SUPABASE_SERVICE_ROLE_KEY not set')
  } else {
    const { status, text } = await postForm(
      '/api/mypos/notify',
      notifyBody({ orderId: 'WC-DOESNOTEXIST', amount: '30.00' }),
    )
    check('verified notify for unknown order → 404 (retryable)', status, 404)
    check('unknown order does NOT return OK', text !== 'OK', true)
  }
}

console.log(
  `\n${failures === 0 ? 'All HTTP checks passed' : `${failures} check(s) FAILED`}` +
    (skipped ? ` — ${skipped} group(s) skipped.` : '.'),
)
process.exit(failures === 0 ? 0 : 1)
