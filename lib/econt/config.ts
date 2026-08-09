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
  const baseUrl = (env('ECONT_BASE_URL') || DEFAULT_BASE_URL).replace(/\/+$/, '')
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

  if (mode === 'live') {
    const missing: string[] = []
    if (!username) missing.push('ECONT_USERNAME')
    if (!password) missing.push('ECONT_PASSWORD')
    if (!sender.phone) missing.push('ECONT_SENDER_PHONE')
    if (!sender.cityName) missing.push('ECONT_SENDER_CITY_NAME')
    if (!sender.cityPostCode) missing.push('ECONT_SENDER_CITY_POST_CODE')
    if (!sender.officeCode && !sender.street) {
      missing.push('ECONT_SENDER_OFFICE_CODE or ECONT_SENDER_STREET')
    }
    if (missing.length > 0) {
      throw new EcontError(
        'config',
        `Econt is in live mode but misconfigured: missing ${missing.join(', ')}`,
        { detail: { missing } },
      )
    }
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
