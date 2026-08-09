import 'server-only'

import { econtPost } from './client'
import { COUNTRY_CODE } from './config'
import { TTL, memoTtl } from './cache'
import type {
  CityDetailsResponse,
  CityDto,
  OfficeDto,
  QuarterDto,
  StreetDto,
} from './dto'
import type {
  EcontCity,
  EcontOffice,
  GetCitiesResponse,
  GetOfficesResponse,
  GetQuartersResponse,
  GetStreetsResponse,
} from './types'

/**
 * Cities, annotated with whether they have a walk-in office and/or an automat.
 *
 * The annotation is why this fetches offices too: the browser needs to filter
 * the city list by delivery type, and doing it here costs one extra upstream
 * call at cache-fill time instead of a round trip per city the customer tries.
 */
export function getCities(): Promise<CityDto[]> {
  return memoTtl('cities', TTL.nomenclature, async () => {
    const [cities, offices] = await bothOrFirstError(fetchCities(), getAllOffices())

    const withOffice = new Set<number>()
    const withAps = new Set<number>()
    for (const office of offices) {
      const cityId = office.address?.city?.id
      if (cityId === undefined) continue
      if (office.isMPS) continue // mobile stations are not a pickup choice
      if (office.isAPS) withAps.add(cityId)
      else withOffice.add(cityId)
    }

    return cities
      .map((city) => toCityDto(city, withOffice.has(city.id), withAps.has(city.id)))
      .sort(byBulgarianName)
  })
}

/** Offices in one city, automats included, mobile stations excluded. */
export function getOffices(cityId: number): Promise<OfficeDto[]> {
  return memoTtl(`offices:${cityId}`, TTL.nomenclature, async () => {
    const res = await econtPost<
      { countryCode: string; cityID: number },
      GetOfficesResponse
    >('Nomenclatures/NomenclaturesService.getOffices.json', {
      countryCode: COUNTRY_CODE,
      cityID: cityId,
    })
    return (res.offices ?? [])
      .filter((o) => !o.isMPS)
      .map(toOfficeDto)
      .sort((a, b) => a.name.localeCompare(b.name, 'bg'))
  })
}

/** Streets and quarters for address-mode delivery. */
export function getCityDetails(cityId: number): Promise<CityDetailsResponse> {
  return memoTtl(`city-details:${cityId}`, TTL.nomenclature, async () => {
    const [streets, quarters] = await bothOrFirstError(
      econtPost<{ cityID: number }, GetStreetsResponse>(
        'Nomenclatures/NomenclaturesService.getStreets.json',
        { cityID: cityId },
      ),
      econtPost<{ cityID: number }, GetQuartersResponse>(
        'Nomenclatures/NomenclaturesService.getQuarters.json',
        { cityID: cityId },
      ),
    )

    return {
      streets: (streets.streets ?? [])
        .map((s): StreetDto => ({ id: s.id, name: text(s.name) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'bg')),
      quarters: (quarters.quarters ?? [])
        .map((q): QuarterDto => ({ id: q.id, name: text(q.name) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'bg')),
    }
  })
}

/**
 * Look an office up by the code the browser sent.
 *
 * The order route uses this to catch a client working from a cache that has
 * since gone stale — better a "pick again" error than a shipment to an office
 * that closed.
 */
export async function findOffice(
  cityId: number,
  code: string,
): Promise<OfficeDto | undefined> {
  const offices = await getOffices(cityId)
  return offices.find((o) => o.code === code)
}

export async function findCity(cityId: number): Promise<CityDto | undefined> {
  const cities = await getCities()
  return cities.find((c) => c.id === cityId)
}

/**
 * Await two calls, rejecting with the first error but never leaving the other
 * rejection unhandled.
 *
 * Promise.all short-circuits: when both calls fail — which is exactly what an
 * Econt outage or a timeout does — it surfaces one and abandons the other, and
 * an abandoned rejection is an unhandled rejection, which Node treats as fatal.
 * A whole-API outage taking the server down with it is not an acceptable
 * failure mode for a delivery price.
 */
async function bothOrFirstError<A, B>(
  a: Promise<A>,
  b: Promise<B>,
): Promise<[A, B]> {
  const [ra, rb] = await Promise.allSettled([a, b])
  if (ra.status === 'rejected') throw ra.reason
  if (rb.status === 'rejected') throw rb.reason
  return [ra.value, rb.value]
}

function fetchCities(): Promise<EcontCity[]> {
  return econtPost<{ countryCode: string }, GetCitiesResponse>(
    'Nomenclatures/NomenclaturesService.getCities.json',
    { countryCode: COUNTRY_CODE },
  ).then((res) => res.cities ?? [])
}

/** Every office in the country — only used to annotate the city list. */
function getAllOffices(): Promise<EcontOffice[]> {
  return memoTtl('offices:all', TTL.nomenclature, () =>
    econtPost<{ countryCode: string }, GetOfficesResponse>(
      'Nomenclatures/NomenclaturesService.getOffices.json',
      { countryCode: COUNTRY_CODE },
    ).then((res) => res.offices ?? []),
  )
}

function toCityDto(
  city: EcontCity,
  hasOffice: boolean,
  hasAps: boolean,
): CityDto {
  return {
    id: city.id,
    name: text(city.name),
    nameEn: text(city.nameEn),
    postCode: text(city.postCode),
    region: text(city.regionName),
    hasOffice,
    hasAps,
  }
}

function toOfficeDto(office: EcontOffice): OfficeDto {
  return {
    code: text(office.code),
    name: text(office.name),
    address: flattenAddress(office),
    isAps: Boolean(office.isAPS),
    isMps: Boolean(office.isMPS),
    hours: formatHours(
      office.normalBusinessHoursFrom,
      office.normalBusinessHoursTo,
    ),
    phone: (office.phones ?? []).map(text).find((p) => p.length > 0) ?? null,
  }
}

/**
 * Coerce whatever Econt sent into a trimmed string.
 *
 * The nomenclature is not as typed as `types.ts` claims. Fields declared string
 * arrive as numbers — post codes and street numbers especially — and a live
 * getOffices response took the office picker down with "e.trim is not a
 * function" while the city list beside it worked fine. `null`, numbers and
 * absent fields all have the same meaning to the UI ("nothing to show"), so they
 * collapse to '' here rather than being asserted away at the type boundary.
 *
 * Every DTO field the browser sees goes through this, so no downstream
 * .trim()/.localeCompare() can be handed a non-string.
 */
function text(v: unknown): string {
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return ''
}

/**
 * Compose the one-line address here rather than in the browser: Econt's
 * `fullAddress` is inconsistently populated, and the pieces need Bulgarian
 * joining rules the UI should not have to know.
 */
function flattenAddress(office: EcontOffice): string {
  const a = office.address
  if (!a) return ''

  // Street numbers arrive as numbers about as often as strings, so every piece
  // is coerced before it is tested for emptiness — a numeric `num` used to be
  // dropped here, quietly shipping "ул. Тодор Александров" with no number on it.
  const quarter = text(a.quarter)
  const street = [text(a.street), text(a.num)].filter(Boolean).join(' ')
  const parts = [street || text(a.other), quarter ? `кв. ${quarter}` : ''].filter(
    Boolean,
  )

  if (parts.length === 0) return text(a.fullAddress)
  return parts.join(', ')
}

/** "08:30 – 18:00", or null when Econt gives us nothing usable. */
function formatHours(from?: unknown, to?: unknown): string | null {
  const f = trimTime(from)
  const t = trimTime(to)
  if (!f || !t) return null
  // A 24/7 automat reads better as words than as 00:00 – 23:59.
  if (f === '00:00' && (t === '23:59' || t === '24:00')) return 'Нон-стоп'
  return `${f} – ${t}`
}

function trimTime(v?: unknown): string | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(text(v))
  if (!m) return null
  return `${m[1].padStart(2, '0')}:${m[2]}`
}

/**
 * Bulgarian collation, with the big cities floated to the top.
 *
 * Strict alphabetical would bury София and Пловдив under villages; a customer
 * scanning the list before typing expects to see them first.
 */
const PRIORITY = ['София', 'Пловдив', 'Варна', 'Бургас', 'Русе', 'Стара Загора']

function byBulgarianName(a: CityDto, b: CityDto): number {
  const ai = PRIORITY.indexOf(a.name)
  const bi = PRIORITY.indexOf(b.name)
  if (ai !== -1 || bi !== -1) {
    if (ai === -1) return 1
    if (bi === -1) return -1
    if (ai !== bi) return ai - bi
  }
  const byName = a.name.localeCompare(b.name, 'bg')
  return byName !== 0 ? byName : a.postCode.localeCompare(b.postCode)
}
