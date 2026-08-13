import 'server-only'

import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { isEcontError, isTransient, toUserMessageBg } from './errors'
import {
  TOO_MANY_REQUESTS_BG,
  checkRateLimit,
  clientIp,
  type Bucket,
} from '@/lib/rate-limit'

/**
 * Nomenclature caching: the browser revalidates, the CDN holds the copy.
 *
 * max-age=0 keeps the browser honest while s-maxage lets Vercel's edge serve it
 * for a day, which is what compensates for memoTtl being per-instance. The long
 * stale-while-revalidate means an Econt outage degrades to slightly stale data
 * rather than a broken city picker.
 */
export const NOMENCLATURE_CACHE_CONTROL =
  'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800'

/** 429 with a Bulgarian message, or null when the request may proceed. */
export function rateLimitGuard(
  request: Request,
  bucket: Bucket,
): NextResponse | null {
  const result = checkRateLimit(clientIp(request.headers), bucket)
  if (result.allowed) return null
  return NextResponse.json(
    { ok: false, message: TOO_MANY_REQUESTS_BG },
    {
      status: 429,
      headers: { 'Retry-After': String(result.retryAfterSeconds) },
    },
  )
}

/**
 * A cacheable JSON response with an ETag, so repeat visitors get a 304 instead
 * of the whole city list again.
 */
export function cachedJson(
  request: Request,
  payload: unknown,
): NextResponse {
  const body = JSON.stringify(payload)
  const etag = `"${createHash('sha1').update(body).digest('base64url')}"`

  if (matchesEtag(request.headers.get('if-none-match'), etag)) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag, 'Cache-Control': NOMENCLATURE_CACHE_CONTROL },
    })
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': NOMENCLATURE_CACHE_CONTROL,
      ETag: etag,
    },
  })
}

function matchesEtag(header: string | null, etag: string): boolean {
  if (!header) return false
  if (header.trim() === '*') return true
  return header
    .split(',')
    .map((v) => v.trim().replace(/^W\//, ''))
    .includes(etag)
}

/**
 * Parse a required positive-integer query parameter.
 *
 * Bad input is rejected here and never forwarded to Econt — an id we did not
 * validate is an id we are asking a third party to interpret for us.
 */
export function positiveIntParam(
  request: Request,
  name: string,
): { value: number } | { error: NextResponse } {
  const raw = new URL(request.url).searchParams.get(name)
  const value = Number(raw)

  if (!raw || !Number.isInteger(value) || value <= 0) {
    return {
      error: NextResponse.json(
        { ok: false, message: 'Невалидна заявка.' },
        { status: 400 },
      ),
    }
  }
  return { value }
}

/**
 * Turn a thrown error into a customer-safe response.
 *
 * Nomenclature failures return 200 with an empty payload plus a `message`, so a
 * dropped city list degrades the picker instead of breaking the whole modal —
 * the customer can still type an address and we confirm by phone.
 */
export function econtErrorResponse(
  error: unknown,
  fallback: Record<string, unknown> = {},
): NextResponse {
  logFailure(error)
  return NextResponse.json(
    { ...fallback, message: toUserMessageBg(error) },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  )
}

export function logFailure(error: unknown): void {
  const kind = isEcontError(error) ? error.kind : 'unknown'
  const level = isTransient(error) ? 'warn' : 'error'
  console[level](
    JSON.stringify({
      evt: 'econt.failure',
      kind,
      message: error instanceof Error ? error.message : String(error),
      detail: isEcontError(error) ? error.detail : undefined,
    }),
  )
}
