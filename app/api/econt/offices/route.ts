import { NextResponse } from 'next/server'
import { callEcont, EcontError } from '@/lib/econt/client'
import { COUNTRY_CODE, NOMENCLATURE_TTL } from '@/lib/econt/config'
import type { Office, RawOffice } from '@/lib/econt/types'

export async function GET(request: Request) {
  const cityIdParam = new URL(request.url).searchParams.get('cityId')
  const cityId = Number(cityIdParam)

  if (!cityIdParam || !Number.isFinite(cityId)) {
    return NextResponse.json({ error: 'Липсва валиден cityId.' }, { status: 400 })
  }

  try {
    const data = await callEcont<{ offices?: RawOffice[] }>(
      'Nomenclatures/NomenclaturesService',
      'getOffices',
      { countryCode: COUNTRY_CODE, cityID: cityId },
      { revalidate: NOMENCLATURE_TTL },
    )

    const offices: Office[] = (data.offices ?? [])
      // Econtomat lockers cannot take a flat-packed playhouse, so they never reach
      // the client. Drop this filter if the real box turns out to fit — see §2.1.
      .filter((o) => o.id != null && o.isAPS !== true)
      .map((o) => ({
        id: o.id,
        code: o.code ?? '',
        name: o.name ?? '',
        address: o.address?.fullAddress ?? '',
        workingHours: formatHours(
          o.normalBusinessHoursFrom,
          o.normalBusinessHoursTo,
        ),
        lat: o.address?.location?.latitude ?? null,
        lon: o.address?.location?.longitude ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'bg'))

    return NextResponse.json({ offices })
  } catch (err) {
    const status = err instanceof EcontError ? err.status : 500
    console.error('[econt/offices]', err)
    return NextResponse.json(
      { error: 'Офисите не можаха да бъдат заредени.' },
      { status: status >= 400 && status < 600 ? status : 500 },
    )
  }
}

/**
 * Econt reports hours as either "09:00" strings or seconds-from-midnight numbers,
 * depending on the endpoint version. Handle both, and give up quietly rather than
 * render something wrong.
 */
function formatHours(
  from: number | string | null | undefined,
  to: number | string | null | undefined,
): string | null {
  const a = normaliseTime(from)
  const b = normaliseTime(to)
  return a && b ? `${a} – ${b}` : null
}

function normaliseTime(value: number | string | null | undefined): string | null {
  if (value == null) return null
  if (typeof value === 'string') {
    return /^\d{1,2}:\d{2}/.test(value) ? value.slice(0, 5) : null
  }
  if (!Number.isFinite(value) || value < 0 || value >= 86_400) return null
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}
