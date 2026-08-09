import 'server-only'

import { getEcontConfig, type EcontConfig } from './config'
import { EcontError } from './errors'
import type { EcontErrorPayload } from './types'

/** Nomenclature payloads are big; quotes must stay snappy. */
const TIMEOUT_MS = { nomenclature: 15_000, default: 8_000 } as const

export type EcontPath = `${string}/${string}.json`

/**
 * POST a JSON body to an e-Econt service method and return the parsed response.
 *
 * The full method path is passed in (e.g.
 * 'Nomenclatures/NomenclaturesService.getCities.json') so every call site is
 * greppable — no clever string assembly to reverse-engineer later.
 */
export async function econtPost<TReq extends object, TRes>(
  path: EcontPath,
  body: TReq,
): Promise<TRes> {
  const config = getEcontConfig()

  if (config.mode === 'fixture') {
    const { fixturePost } = await import('./fixture-client')
    return fixturePost<TReq, TRes>(path, body, config)
  }

  return livePost<TReq, TRes>(path, body, config)
}

async function livePost<TReq extends object, TRes>(
  path: EcontPath,
  body: TReq,
  config: EcontConfig,
): Promise<TRes> {
  const url = `${config.baseUrl}/${path}`
  const timeout = path.includes('Nomenclatures')
    ? TIMEOUT_MS.nomenclature
    : TIMEOUT_MS.default
  const started = Date.now()

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: basicAuth(config.username, config.password),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
      // We cache semantically in cache.ts. Next's fetch cache would try to
      // serialize multi-megabyte nomenclature responses into the Data Cache.
      cache: 'no-store',
    })
  } catch (cause) {
    const timedOut =
      cause instanceof Error &&
      (cause.name === 'TimeoutError' || cause.name === 'AbortError')
    const kind = timedOut ? 'timeout' : 'network'
    logCall({ path, status: 0, kind, durationMs: Date.now() - started })
    throw new EcontError(
      kind,
      timedOut
        ? `Econt did not respond within ${timeout}ms`
        : 'Could not reach Econt',
      { cause },
    )
  }

  const durationMs = Date.now() - started
  const text = await res.text()

  if (res.status === 401 || res.status === 403) {
    logCall({ path, status: res.status, kind: 'auth', durationMs })
    throw new EcontError('auth', 'Econt rejected our credentials', {
      detail: truncate(text),
    })
  }

  if (!res.ok) {
    logCall({ path, status: res.status, kind: 'upstream', durationMs })
    throw new EcontError('upstream', `Econt returned HTTP ${res.status}`, {
      detail: truncate(text),
    })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (cause) {
    logCall({ path, status: res.status, kind: 'upstream', durationMs })
    throw new EcontError('upstream', 'Econt returned a non-JSON body', {
      cause,
      detail: truncate(text),
    })
  }

  // Econt reports business-level problems inside a 200.
  const failure = readErrorPayload(parsed)
  if (failure) {
    logCall({ path, status: res.status, kind: 'validation', durationMs })
    throw new EcontError('validation', failure.message, {
      field: failure.field,
      detail: failure.detail,
    })
  }

  logCall({ path, status: res.status, kind: 'ok', durationMs })
  return parsed as TRes
}

function basicAuth(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
}

/**
 * Pull a usable failure out of an Econt 200 response.
 *
 * The message returned here is upstream text and is NOT customer-facing —
 * callers translate it (see shipping.ts). Returns null when the payload looks
 * like a normal success.
 */
export function readErrorPayload(
  parsed: unknown,
): { message: string; field?: string; detail: unknown } | null {
  if (!parsed || typeof parsed !== 'object') return null
  const p = parsed as EcontErrorPayload

  const list = [
    ...(Array.isArray(p.errors) ? p.errors : []),
    ...(Array.isArray(p.validationErrors) ? p.validationErrors : []),
  ]
  if (list.length > 0) {
    const first = list[0]
    return {
      message: first?.message || first?.type || 'Econt validation error',
      field: first?.fields?.[0],
      detail: list,
    }
  }

  // A bare { type, message } with no payload alongside it is Econt's other
  // failure shape. `message` on its own is not enough — successful responses
  // sometimes carry one.
  if (p.type && p.message) {
    return { message: p.message, field: p.fields?.[0], detail: p }
  }

  return null
}

/**
 * One structured line per call. Deliberately never logs the request body: it
 * carries the customer's name, phone and address.
 */
function logCall(entry: {
  path: string
  status: number
  kind: string
  durationMs: number
}): void {
  const level = entry.kind === 'ok' ? 'log' : entry.kind === 'auth' ? 'error' : 'warn'
  console[level](
    JSON.stringify({ evt: 'econt.call', ...entry, ...(entry.kind === 'auth' ? { code: 'ECONT_AUTH_REJECTED' } : {}) }),
  )
}

function truncate(s: string, max = 500): string {
  return s.length > max ? `${s.slice(0, max)}…` : s
}
