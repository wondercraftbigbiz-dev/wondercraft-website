/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * Scope is one server instance, so this is a speed bump against a script
 * hammering the checkout endpoint with junk orders — not a security control.
 * On serverless it resets per cold start and is not shared between instances;
 * if abuse ever becomes real, move this to a shared store.
 */

type Window = { count: number; resetAt: number }

const windows = new Map<string, Window>()
const MAX_TRACKED_KEYS = 5000

export type RateLimitResult = {
  allowed: boolean
  /** Seconds until the window resets. */
  retryAfter: number
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now()
  const existing = windows.get(key)

  if (!existing || existing.resetAt <= now) {
    // Opportunistic cleanup so a long-lived instance cannot grow unbounded.
    if (windows.size >= MAX_TRACKED_KEYS) {
      for (const [k, w] of windows) {
        if (w.resetAt <= now) windows.delete(k)
      }
      if (windows.size >= MAX_TRACKED_KEYS) windows.clear()
    }

    windows.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfter: 0 }
  }

  existing.count += 1
  if (existing.count > limit) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }

  return { allowed: true, retryAfter: 0 }
}

/** Best-effort client IP from proxy headers. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}
