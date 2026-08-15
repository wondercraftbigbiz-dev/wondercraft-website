import { sign, verify } from 'node:crypto'
import type { KeyObject } from 'node:crypto'

/**
 * myPOS request/response signing.
 *
 * The algorithm (per the myPOS Checkout SDKs):
 *   1. take every POST value except Signature, IN THE ORDER IT APPEARS
 *   2. join them with "-"
 *   3. base64-encode that concatenation
 *   4. RSA-sign the base64 string with SHA-256
 *   5. base64-encode the signature
 *
 * Step 1 is why fields are carried as an ordered array of tuples rather than a
 * plain object: the same value is used both to sign and to render the form, so
 * the two cannot drift apart. An object would make the order implicit and a
 * single reordered key would break signing with an opaque error from myPOS.
 */

export type MyposField = readonly [name: string, value: string]

/** The exact string that gets signed. Exported for tests and debugging. */
export function buildSignatureBase(fields: readonly MyposField[]): string {
  const concatenated = fields.map(([, value]) => value).join('-')
  return Buffer.from(concatenated, 'utf8').toString('base64')
}

export function signFields(
  fields: readonly MyposField[],
  privateKey: KeyObject,
): string {
  const base = buildSignatureBase(fields)
  // RSA keys default to PKCS#1 v1.5 padding here, matching openssl_sign() in
  // the reference PHP SDK.
  return sign('sha256', Buffer.from(base, 'utf8'), privateKey).toString('base64')
}

export function verifyFields(
  fields: readonly MyposField[],
  signature: string,
  publicKey: KeyObject,
): boolean {
  if (!signature) return false

  const base = buildSignatureBase(fields)
  try {
    return verify(
      'sha256',
      Buffer.from(base, 'utf8'),
      publicKey,
      Buffer.from(signature, 'base64'),
    )
  } catch {
    // A malformed signature must read as "not verified", never as a crash that
    // could be mistaken for a server fault and retried forever.
    return false
  }
}

/** Convenience for rendering: ordered tuples to a plain object for the form. */
export function fieldsToRecord(
  fields: readonly MyposField[],
): Record<string, string> {
  return Object.fromEntries(fields)
}
