import 'server-only'

/**
 * A sliding-window rate limiter held in process memory.
 *
 * Be clear about what this is: a speed bump. Limits are per instance, so the
 * effective ceiling multiplies by however many instances are running, and a
 * cold start forgets everything. It exists to stop a single client hammering
 * our Econt quota by accident or with a loop, not to withstand a real attack.
 *
 * The controls that actually matter are elsewhere: quote results are memoized
 * for five minutes, so repeated identical requests cost nothing upstream, and
 * quote requests carry only a plan id, so nobody can use us as a general-purpose
 * Econt price oracle. Vercel's WAF is the next step if traffic warrants it.
 */
export type Bucket = 'quote' | 'nomenclature' | 'order'

type Limit = { windowMs: number; max: number }

const LIMITS: Record<Bucket, Limit[]> = {
  quote: [
    { windowMs: 60_000, max: 20 },
    { windowMs: 3_600_000, max: 200 },
  ],
  nomenclature: [{ windowMs: 60_000, max: 60 }],
  order: [
    { windowMs: 60_000, max: 5 },
    { windowMs: 3_600_000, max: 20 },
  ],
}

/** key -> ascending timestamps of recent hits */
const hits = new Map<string, number[]>()
const LONGEST_WINDOW_MS = 3_600_000
let lastPrune = 0

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number }

export function checkRateLimit(ip: string, bucket: Bucket): RateLimitResult {
  const now = Date.now()
  prune(now)

  const key = `${bucket}:${ip}`
  const recent = (hits.get(key) ?? []).filter(
    (t) => now - t < LONGEST_WINDOW_MS,
  )

  for (const limit of LIMITS[bucket]) {
    const inWindow = recent.filter((t) => now - t < limit.windowMs)
    if (inWindow.length >= limit.max) {
      const oldest = inWindow[0]
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((limit.windowMs - (now - oldest)) / 1000),
      )
      // Do not record the rejected attempt: a client that keeps retrying would
      // otherwise push its own reset time further away forever.
      hits.set(key, recent)
      return { allowed: false, retryAfterSeconds }
    }
  }

  recent.push(now)
  hits.set(key, recent)
  return { allowed: true }
}

/**
 * The client's IP, from the proxy headers Vercel sets.
 *
 * Falls back to a single shared key rather than to something unique-per-request:
 * if the headers are missing, a shared key degrades to a global limit, whereas a
 * unique key would silently disable the limiter altogether.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  if (first) return first
  return headers.get('x-real-ip')?.trim() || 'unknown'
}

export const TOO_MANY_REQUESTS_BG =
  'Твърде много заявки. Опитайте отново след малко.'

function prune(now: number): void {
  if (now - lastPrune < 60_000) return
  lastPrune = now
  for (const [key, times] of hits) {
    const kept = times.filter((t) => now - t < LONGEST_WINDOW_MS)
    if (kept.length === 0) hits.delete(key)
    else hits.set(key, kept)
  }
}

/** Test seam. */
export function resetRateLimits(): void {
  hits.clear()
  lastPrune = 0
}
