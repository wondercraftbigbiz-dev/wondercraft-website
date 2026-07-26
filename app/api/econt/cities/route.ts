import { NextResponse } from 'next/server'
import { callEcont, EcontError } from '@/lib/econt/client'
import { COUNTRY_CODE, NOMENCLATURE_TTL } from '@/lib/econt/config'
import type { City, RawCity } from '@/lib/econt/types'

export async function GET() {
  try {
    const data = await callEcont<{ cities?: RawCity[] }>(
      'Nomenclatures/NomenclaturesService',
      'getCities',
      { countryCode: COUNTRY_CODE },
      { revalidate: NOMENCLATURE_TTL },
    )

    // Slim hard: the raw payload carries coordinates, municipality objects and
    // per-weekday service flags the picker never renders.
    const cities: City[] = (data.cities ?? [])
      .filter((c) => c.id != null && c.name)
      .map((c) => ({
        id: c.id,
        name: c.name ?? '',
        nameEn: c.nameEn ?? '',
        postCode: c.postCode ?? '',
        regionName: c.regionName ?? '',
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'bg'))

    return NextResponse.json({ cities })
  } catch (err) {
    return errorResponse(err)
  }
}

function errorResponse(err: unknown) {
  const status = err instanceof EcontError ? err.status : 500
  console.error('[econt/cities]', err)
  return NextResponse.json(
    { error: 'Списъкът с градове не можа да бъде зареден.' },
    { status: status >= 400 && status < 600 ? status : 500 },
  )
}
