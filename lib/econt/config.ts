import 'server-only'

import { DISPATCH, type Dispatch } from '@/lib/data/dispatch'
import { EcontError } from './errors'

export type EcontMode = 'live' | 'fixture'

export type EcontFault =
  | 'timeout'
  | 'auth'
  | 'validation'
  | 'upstream'
  | 'empty'
  | null

export type EcontConfig = {
  mode: EcontMode
  baseUrl: string
  username: string
  password: string
  sender: Dispatch
  fault: EcontFault
}

/**
 * Fixture mode only. Live mode must name its base URL explicitly.
 *
 * Defaulting live mode to demo would be the one silent failure in this file:
 * credentials set, ECONT_BASE_URL forgotten, and the shop quotes demo tariffs as
 * if they were the contract's. Nothing errors, nothing logs, and the difference
 * is absorbed on every order. A missing base URL is a misconfiguration, so it is
 * treated as one — see getEcontConfig below.
 */
const DEFAULT_BASE_URL = 'https://demo.econt.com/ee/services'

function env(name: string): string {
  return (process.env[name] ?? '').trim()
}

/**
 * Read and validate configuration.
 *
 * Throws EcontError('config') rather than returning something half-valid, so a
 * misconfigured deploy degrades into "we'll confirm the price by phone" instead
 * of a 500 or, worse, a shipment addressed to nobody.
 */
export function getEcontConfig(): EcontConfig {
  const mode: EcontMode = env('ECONT_MODE') === 'live' ? 'live' : 'fixture'
  const configuredBaseUrl = env('ECONT_BASE_URL')
  const baseUrl = (
    mode === 'live' ? configuredBaseUrl : configuredBaseUrl || DEFAULT_BASE_URL
  ).replace(/\/+$/, '')
  const username = env('ECONT_USERNAME')
  const password = env('ECONT_PASSWORD')

  // Only credentials are checked here, because only credentials are needed by
  // every call. Sender details are validated separately — see
  // assertSenderConfigured below.
  if (mode === 'live') {
    const missing: string[] = []
    if (!baseUrl) missing.push('ECONT_BASE_URL')
    if (!username) missing.push('ECONT_USERNAME')
    if (!password) missing.push('ECONT_PASSWORD')
    if (missing.length > 0) throw misconfigured(missing)
  }

  return {
    mode,
    baseUrl,
    username,
    password,
    // Not read from the environment: see lib/data/dispatch.ts.
    sender: DISPATCH,
    fault: parseFault(env('ECONT_FIXTURE_FAULT')),
  }
}

/**
 * Validate the sender, which only shipments need.
 *
 * Deliberately not part of getEcontConfig(): that runs on every call, including
 * nomenclature lookups, and folding the sender into it made the configuration
 * circular — you could not list offices to find your own office code, because
 * listing offices refused to run until the office code was set. A city list has
 * no sender, so it should not require one. That still holds now the values live
 * in code, because the office list is how the office code is found.
 *
 * The union in lib/data/dispatch.ts means a missing field is mostly a typecheck
 * error rather than something to assert here. What is left is what types cannot
 * express: a field present but empty.
 */
export function assertSenderConfigured(config: EcontConfig): void {
  if (config.mode !== 'live') return

  const { sender } = config
  const missing: string[] = []
  if (!sender.name.trim()) missing.push('DISPATCH.name')
  if (!sender.phone.trim()) missing.push('DISPATCH.phone')

  if (sender.kind === 'office') {
    if (!sender.officeCode.trim()) missing.push('DISPATCH.officeCode')
  } else {
    if (!sender.cityName.trim()) missing.push('DISPATCH.cityName')
    if (!sender.cityPostCode.trim()) missing.push('DISPATCH.cityPostCode')
    if (!sender.street.trim()) missing.push('DISPATCH.street')
    if (!sender.streetNum.trim()) missing.push('DISPATCH.streetNum')
  }

  if (missing.length > 0) throw misconfigured(missing)
}

function misconfigured(missing: string[]): EcontError {
  return new EcontError(
    'config',
    `Econt is in live mode but misconfigured: missing ${missing.join(', ')}`,
    { detail: { missing } },
  )
}

export type { Dispatch as EcontSender }

function parseFault(raw: string): EcontFault {
  switch (raw) {
    case 'timeout':
    case 'auth':
    case 'validation':
    case 'upstream':
    case 'empty':
      return raw
    default:
      return null
  }
}

/** Bulgaria. Econt's nomenclature is keyed on ISO 3166-1 alpha-3. */
export const COUNTRY_CODE = 'BGR'
