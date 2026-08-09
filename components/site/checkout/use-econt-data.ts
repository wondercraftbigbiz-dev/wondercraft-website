'use client'

import { useEffect, useState } from 'react'
import type {
  CitiesResponse,
  CityDetailsResponse,
  CityDto,
  OfficeDto,
  OfficesResponse,
  QuarterDto,
  StreetDto,
} from '@/lib/econt/dto'

export type Loadable<T> =
  | { status: 'loading' }
  | { status: 'ok'; data: T }
  | { status: 'error'; message: string }

const OFFLINE =
  'Не успяхме да заредим данните от Еконт. Опитайте отново или продължете — ще потвърдим доставката по телефон.'

/**
 * The city list, fetched once per page load and shared by every consumer.
 *
 * Module-scope so re-opening the modal is instant, and so this stays behind one
 * interface — if the payload ever outgrows its budget and the route switches to
 * a `?q=` search endpoint, only this hook changes.
 */
let citiesPromise: Promise<CityDto[]> | null = null

function loadCities(): Promise<CityDto[]> {
  citiesPromise ??= fetchJson<CitiesResponse>('/api/econt/cities')
    .then((res) => res.cities ?? [])
    .catch((err) => {
      // Do not cache the failure, or a single blip breaks the picker until reload.
      citiesPromise = null
      throw err
    })
  return citiesPromise
}

/** Fetched lazily on first modal open, never on page load — the marketing
 * page's LCP should not pay for a checkout the visitor may never open. */
export function useCities(enabled: boolean): Loadable<CityDto[]> {
  const [state, setState] = useState<Loadable<CityDto[]>>({ status: 'loading' })

  useEffect(() => {
    if (!enabled) return
    let live = true
    loadCities().then(
      (data) => live && setState({ status: 'ok', data }),
      () => live && setState({ status: 'error', message: OFFLINE }),
    )
    return () => {
      live = false
    }
  }, [enabled])

  return state
}

export function useOffices(cityId: number | null): Loadable<OfficeDto[]> {
  return useCityResource(
    cityId,
    (id, signal) =>
      fetchJson<OfficesResponse>(`/api/econt/offices?cityId=${id}`, signal).then(
        (res) => res.offices ?? [],
      ),
    [],
  )
}

export function useCityDetails(
  cityId: number | null,
): Loadable<{ streets: StreetDto[]; quarters: QuarterDto[] }> {
  return useCityResource(
    cityId,
    (id, signal) =>
      fetchJson<CityDetailsResponse>(
        `/api/econt/city-details?cityId=${id}`,
        signal,
      ).then((res) => ({
        streets: res.streets ?? [],
        quarters: res.quarters ?? [],
      })),
    { streets: [], quarters: [] },
  )
}

/**
 * Per-city fetch with a small session cache, so switching back to a city the
 * customer already looked at is instant and costs no request.
 */
function useCityResource<T>(
  cityId: number | null,
  load: (cityId: number, signal: AbortSignal) => Promise<T>,
  empty: T,
): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>(
    cityId ? { status: 'loading' } : { status: 'ok', data: empty },
  )

  useEffect(() => {
    if (!cityId) {
      setState({ status: 'ok', data: empty })
      return
    }

    const cached = resourceCache.get(cacheKey(load, cityId)) as T | undefined
    if (cached !== undefined) {
      setState({ status: 'ok', data: cached })
      return
    }

    const controller = new AbortController()
    setState({ status: 'loading' })
    load(cityId, controller.signal).then(
      (data) => {
        resourceCache.set(cacheKey(load, cityId), data)
        if (!controller.signal.aborted) setState({ status: 'ok', data })
      },
      (err) => {
        if (controller.signal.aborted || isAbort(err)) return
        setState({ status: 'error', message: OFFLINE })
      },
    )
    return () => controller.abort()
    // `empty` and `load` are stable module-level values at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId])

  return state
}

const resourceCache = new Map<string, unknown>()
const loaderIds = new WeakMap<object, string>()
let nextLoaderId = 0

function cacheKey(loader: object, cityId: number): string {
  let id = loaderIds.get(loader)
  if (!id) {
    id = `l${nextLoaderId++}`
    loaderIds.set(loader, id)
  }
  return `${id}:${cityId}`
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`${url} responded ${res.status}`)
  const body = (await res.json()) as T & { message?: string }
  // The routes answer 200 with an empty payload plus a message when Econt is
  // unreachable, so the modal degrades instead of breaking. Surface that as an
  // error here so the UI can offer a retry.
  if (body.message) throw new Error(body.message)
  return body
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}
