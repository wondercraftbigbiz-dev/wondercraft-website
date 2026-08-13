import 'server-only'

/**
 * A tiny in-process TTL memo for large, rarely-changing, read-only data —
 * Econt's city and office nomenclatures.
 *
 * Why not Next's caching primitives: a route that reads searchParams is dynamic,
 * so segment `revalidate` never engages; `'use cache'` requires turning on
 * experimental.cacheComponents, a global behaviour change to a working site; and
 * unstable_cache serializes into the Data Cache, which is the wrong place for
 * multi-megabyte payloads. The real cross-instance cache is the CDN, via the
 * Cache-Control headers the routes set.
 *
 * It stores the *promise*, not the resolved value, so N concurrent misses make
 * one upstream call instead of N.
 */
type Entry<T> = { at: number; value: Promise<T> }

const store = new Map<string, Entry<unknown>>()

export function memoTtl<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined
  if (hit && Date.now() - hit.at < ttlMs) return hit.value

  const value = loader().catch((err) => {
    // Never cache a failure: the next request should retry, not inherit it.
    if (store.get(key)?.value === value) store.delete(key)
    throw err
  })

  store.set(key, { at: Date.now(), value } as Entry<unknown>)

  // Mark the stored promise as handled. Callers still see the rejection, but
  // without this a caller that never awaits it — Promise.all short-circuiting on
  // a sibling rejection is the usual way — leaves an unhandled rejection, which
  // Node reports as a crash.
  void value.catch(() => {})

  return value
}

/** Drop entries whose key starts with `prefix`. Pass nothing to clear all. */
export function invalidate(prefix?: string): void {
  if (prefix === undefined) {
    store.clear()
    return
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}

export const TTL = {
  /** Cities, offices, streets, quarters — Econt changes these rarely. */
  nomenclature: 24 * 60 * 60 * 1000,
  /** Quotes — long enough to absorb double-clicks and re-renders. */
  quote: 5 * 60 * 1000,
} as const
