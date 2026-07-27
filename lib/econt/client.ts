import { econtConfig } from './config'

/**
 * The only place that knows how to talk to Econt.
 *
 * Econt sends no CORS headers, so this must never run in the browser — every
 * call goes through a route handler in app/api/econt/*.
 */

export class EcontError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'EcontError'
  }
}

/**
 * `service` is the full path segment pair, e.g. "Nomenclatures/NomenclaturesService"
 * or "Shipments/LabelService" — the two do not follow the same naming rule, so it is
 * passed whole rather than derived.
 */
export async function callEcont<T>(
  service: string,
  method: string,
  body: unknown,
  { revalidate }: { revalidate?: number } = {},
): Promise<T> {
  const { baseUrl, username, password } = econtConfig

  if (!username || !password) {
    throw new EcontError(
      'Missing ECONT_USERNAME / ECONT_PASSWORD. Copy .env.example to .env.local.',
      500,
    )
  }

  const url = `${baseUrl}/${service}.${method}.json`
  const auth = Buffer.from(`${username}:${password}`).toString('base64')

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      // Nomenclatures get cached; price quotes pass no revalidate and stay uncached.
      ...(revalidate === undefined
        ? { cache: 'no-store' as const }
        : { next: { revalidate } }),
    })
  } catch (cause) {
    throw new EcontError(`Could not reach Econt at ${url}: ${String(cause)}`, 502)
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    const hint =
      res.status === 401
        ? ' (check the demo credentials — both "iasp-dev" and "1Asp-dev" are documented)'
        : ''
    throw new EcontError(
      `Econt ${method} failed: ${res.status}${hint} ${detail.slice(0, 300)}`,
      res.status,
    )
  }

  return (await res.json()) as T
}
