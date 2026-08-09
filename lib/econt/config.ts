import 'server-only'

import { EcontError } from './errors'

export type EcontMode = 'live' | 'fixture'

export type EcontFault =
  | 'timeout'
  | 'auth'
  | 'validation'
  | 'upstream'
  | 'empty'
  | null

/** Where we ship from. Econt needs a sender on every shipment, even to price one. */
export type EcontSender = {
  name: string
  phone: string
  cityName: string
  cityPostCode: string
  /** Set when we drop parcels at an office. Takes precedence over the address. */
  officeCode?: string
  street?: string
  streetNum?: string
  streetOther?: string
}

export type EcontConfig = {
  mode: EcontMode
  baseUrl: string
  username: string
  password: string
  sender: EcontSender
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

  const sender: EcontSender = {
    name: env('ECONT_SENDER_NAME') || 'WonderCraft',
    phone: env('ECONT_SENDER_PHONE'),
    cityName: env('ECONT_SENDER_CITY_NAME'),
    cityPostCode: env('ECONT_SENDER_CITY_POST_CODE'),
    officeCode: env('ECONT_SENDER_OFFICE_CODE') || undefined,
    street: env('ECONT_SENDER_STREET') || undefined,
    streetNum: env('ECONT_SENDER_STREET_NUM') || undefined,
    streetOther: env('ECONT_SENDER_STREET_OTHER') || undefined,
  }

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
    sender,
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
 * no sender, so it should not require one.
 *
 * Throws the same EcontError('config') as before, so a misconfigured deploy still
 * degrades the quote to "we'll confirm by phone" rather than breaking the picker.
 */
export function assertSenderConfigured(config: EcontConfig): void {
  if (config.mode !== 'live') return

  const { sender } = config
  const missing: string[] = []
  if (!sender.phone) missing.push('ECONT_SENDER_PHONE')
  if (!sender.cityName) missing.push('ECONT_SENDER_CITY_NAME')
  if (!sender.cityPostCode) missing.push('ECONT_SENDER_CITY_POST_CODE')
  if (!sender.officeCode && !sender.street) {
    missing.push('ECONT_SENDER_OFFICE_CODE or ECONT_SENDER_STREET')
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
