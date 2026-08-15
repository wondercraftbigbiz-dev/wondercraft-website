import { createPrivateKey, createPublicKey, X509Certificate } from 'node:crypto'
import type { KeyObject } from 'node:crypto'

/**
 * myPOS Checkout configuration, read from the environment.
 *
 * Nothing here runs at module load — a missing or malformed key must surface as
 * a clear error on the request that needs it, never as a broken build.
 */

export const MYPOS_ENDPOINTS = {
  test: 'https://www.mypos.eu/vmp/checkout-test',
  production: 'https://www.mypos.eu/vmp/checkout',
} as const

export type MyposEnv = keyof typeof MYPOS_ENDPOINTS

const REQUIRED_VARS = [
  'MYPOS_SID',
  'MYPOS_WALLET_NUMBER',
  'MYPOS_KEY_INDEX',
  'MYPOS_PRIVATE_KEY',
  'MYPOS_API_PUBLIC_KEY',
] as const

export type MyposConfig = {
  env: MyposEnv
  endpoint: string
  sid: string
  walletNumber: string
  keyIndex: string
  privateKey: KeyObject
  apiPublicKey: KeyObject
  /** Absolute origin used to build URL_OK / URL_Cancel / URL_Notify. */
  siteUrl: string
}

/**
 * Whether card payment can be offered at all. Used as a feature flag so the
 * site keeps working (enquiry form only) before credentials exist.
 *
 * Deliberately cheap: presence only, no key parsing.
 */
export function isMyposConfigured(): boolean {
  return (
    REQUIRED_VARS.every((name) => Boolean(process.env[name]?.trim())) &&
    Boolean(resolveSiteUrl())
  )
}

/**
 * Accepts a PEM in whichever shape survived the trip through the hosting
 * provider's environment-variable UI:
 *   - real multi-line PEM
 *   - PEM with literal "\n" escapes instead of newlines
 *   - base64 of the whole PEM file
 *
 * Also accepts an X.509 certificate where a public key is expected, since myPOS
 * hands out a .crt rather than a bare public key.
 */
export function normalizePem(raw: string): string {
  let pem = raw
    .trim()
    // Strip wrapping quotes some UIs add.
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

function loadPrivateKey(varName: string): KeyObject {
  const raw = process.env[varName]
  if (!raw?.trim()) throw new Error(`${varName} is not set.`)

  const pem = normalizePem(raw)
  if (!pem.includes('-----BEGIN')) {
    throw new Error(
      `${varName} does not look like a PEM key. Expected "-----BEGIN ... PRIVATE KEY-----", ` +
        `optionally with \\n escapes or base64-encoded.`,
    )
  }

  try {
    return createPrivateKey(pem)
  } catch (cause) {
    throw new Error(`${varName} could not be parsed as an RSA private key.`, { cause })
  }
}

function loadPublicKey(varName: string): KeyObject {
  const raw = process.env[varName]
  if (!raw?.trim()) throw new Error(`${varName} is not set.`)

  const pem = normalizePem(raw)
  if (!pem.includes('-----BEGIN')) {
    throw new Error(
      `${varName} does not look like a PEM key or certificate. Expected ` +
        `"-----BEGIN PUBLIC KEY-----" or "-----BEGIN CERTIFICATE-----", ` +
        `optionally with \\n escapes or base64-encoded.`,
    )
  }

  try {
    // myPOS distributes its key as a certificate; extract the public key from it.
    if (pem.includes('-----BEGIN CERTIFICATE-----')) {
      return new X509Certificate(pem).publicKey
    }
    return createPublicKey(pem)
  } catch (cause) {
    throw new Error(`${varName} could not be parsed as an RSA public key.`, { cause })
  }
}

function resolveSiteUrl(): string | undefined {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')

  // Vercel sets VERCEL_URL (host only, no scheme) on preview deployments.
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel.replace(/\/+$/, '')}`

  return undefined
}

let cached: MyposConfig | undefined

/**
 * Reads and validates the full configuration. Throws a descriptive error naming
 * the offending variable rather than letting a bad key produce a silently
 * invalid signature.
 */
export function getMyposConfig(): MyposConfig {
  if (cached) return cached

  const missing = REQUIRED_VARS.filter((name) => !process.env[name]?.trim())
  if (missing.length > 0) {
    throw new Error(`myPOS is not configured. Missing: ${missing.join(', ')}.`)
  }

  const siteUrl = resolveSiteUrl()
  if (!siteUrl) {
    throw new Error(
      'NEXT_PUBLIC_SITE_URL is not set. myPOS requires absolute HTTPS callback URLs.',
    )
  }
  if (!siteUrl.startsWith('https://') && !siteUrl.startsWith('http://localhost')) {
    throw new Error(
      `NEXT_PUBLIC_SITE_URL must be https (got ${siteUrl}). myPOS rejects a non-SSL URL_Notify ` +
        'and reverses the transaction.',
    )
  }

  const envValue = (process.env.MYPOS_ENV?.trim() || 'test') as MyposEnv
  if (!(envValue in MYPOS_ENDPOINTS)) {
    throw new Error(
      `MYPOS_ENV must be one of ${Object.keys(MYPOS_ENDPOINTS).join(' | ')} (got "${envValue}").`,
    )
  }

  cached = {
    env: envValue,
    endpoint: MYPOS_ENDPOINTS[envValue],
    sid: process.env.MYPOS_SID!.trim(),
    walletNumber: process.env.MYPOS_WALLET_NUMBER!.trim(),
    keyIndex: process.env.MYPOS_KEY_INDEX!.trim(),
    privateKey: loadPrivateKey('MYPOS_PRIVATE_KEY'),
    apiPublicKey: loadPublicKey('MYPOS_API_PUBLIC_KEY'),
    siteUrl,
  }

  return cached
}

/** Test seam: forget the memoised config so env changes take effect. */
export function resetMyposConfigCache(): void {
  cached = undefined
}
