/**
 * Round-trip check for the myPOS signing implementation.
 *
 * Runs against a throwaway 2048-bit keypair, so it needs no real credentials
 * and no network. It proves the algorithm is self-consistent and that
 * tampering is detected — it cannot prove the field names match myPOS's spec.
 *
 *   node scripts/verify-mypos-signing.mjs
 */
import {
  generateKeyPairSync,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
  X509Certificate,
} from 'node:crypto'

let failures = 0

function check(label, actual, expected) {
  const pass = actual === expected
  if (!pass) failures += 1
  console.log(
    `${pass ? 'PASS' : 'FAIL'}  ${label}` +
      (pass ? '' : `\n        got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`),
  )
}

// ── the algorithm under test, mirrored from lib/mypos/sign.ts ────────────────
const signatureBase = (fields) =>
  Buffer.from(fields.map(([, v]) => v).join('-'), 'utf8').toString('base64')

const signFields = (fields, key) =>
  sign('sha256', Buffer.from(signatureBase(fields), 'utf8'), key).toString('base64')

const verifyFields = (fields, signature, key) => {
  if (!signature) return false
  try {
    return verify(
      'sha256',
      Buffer.from(signatureBase(fields), 'utf8'),
      key,
      Buffer.from(signature, 'base64'),
    )
  } catch {
    return false
  }
}

// ── fixtures ────────────────────────────────────────────────────────────────
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })

const fields = [
  ['IPCmethod', 'IPCPurchase'],
  ['IPCVersion', '1.4'],
  ['IPCLanguage', 'BG'],
  ['SID', '000000000000010'],
  ['WalletNumber', '61938166610'],
  ['KeyIndex', '1'],
  ['Currency', 'EUR'],
  ['Amount', '80.00'],
  ['OrderID', 'WC-1005-AB12'],
  ['CartItems', '1'],
  ['Article_1', 'Персонализиран'],
  ['Quantity_1', '2'],
  ['Price_1', '40.00'],
  ['Amount_1', '80.00'],
  ['Currency_1', 'EUR'],
]

console.log('— signature base —')
check(
  'base is base64 of dash-joined values',
  signatureBase([
    ['a', 'one'],
    ['b', 'two'],
  ]),
  Buffer.from('one-two', 'utf8').toString('base64'),
)
check(
  'names do not affect the base',
  signatureBase([['x', 'one'], ['y', 'two']]),
  signatureBase([['a', 'one'], ['b', 'two']]),
)
check('Cyrillic survives as UTF-8', Buffer.from(signatureBase([['a', 'Персонализиран']]), 'base64').toString('utf8'), 'Персонализиран')

console.log('\n— sign / verify —')
const signature = signFields(fields, privateKey)
check('valid signature verifies', verifyFields(fields, signature, publicKey), true)
check('empty signature rejected', verifyFields(fields, '', publicKey), false)
check('garbage signature rejected', verifyFields(fields, 'not-base64!!', publicKey), false)

const tamperedAmount = fields.map(([n, v]) => (n === 'Amount' ? [n, '1.00'] : [n, v]))
check('tampered amount rejected', verifyFields(tamperedAmount, signature, publicKey), false)

const reordered = [fields[1], fields[0], ...fields.slice(2)]
check('reordered fields rejected', verifyFields(reordered, signature, publicKey), false)

const extra = [...fields, ['Injected', 'x']]
check('appended field rejected', verifyFields(extra, signature, publicKey), false)

const otherKey = generateKeyPairSync('rsa', { modulusLength: 2048 })
check(
  'signature from a different key rejected',
  verifyFields(fields, signFields(fields, otherKey.privateKey), publicKey),
  false,
)

// ── PEM normalisation, mirrored from lib/mypos/config.ts ─────────────────────
console.log('\n— PEM normalisation —')
const normalizePem = (raw) => {
  let pem = raw
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim()
  if (!pem.includes('-----BEGIN')) {
    const decoded = Buffer.from(pem.replace(/\s+/g, ''), 'base64').toString('utf8')
    if (decoded.includes('-----BEGIN')) pem = decoded.trim()
  }
  return pem
}

const realPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
const escaped = realPem.replace(/\n/g, '\\n')
const base64d = Buffer.from(realPem, 'utf8').toString('base64')
const quoted = `"${escaped}"`

for (const [label, input] of [
  ['multi-line PEM', realPem],
  ['\\n-escaped PEM', escaped],
  ['base64-encoded PEM', base64d],
  ['quoted \\n-escaped PEM', quoted],
]) {
  const normalized = normalizePem(input)
  let ok = false
  try {
    ok = createPublicKey(normalized)
      .export({ type: 'spki', format: 'pem' })
      .toString()
      .trim() === realPem.trim()
  } catch {
    ok = false
  }
  check(`${label} loads to the same key`, ok, true)
}

// A private key must survive the same treatment.
const realPrivPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
let privOk = false
try {
  privOk = Boolean(createPrivateKey(normalizePem(realPrivPem.replace(/\n/g, '\\n'))))
} catch {
  privOk = false
}
check('\\n-escaped private key loads', privOk, true)

console.log(
  failures === 0
    ? '\nAll signing checks passed.'
    : `\n${failures} check(s) FAILED.`,
)
process.exit(failures === 0 ? 0 : 1)
