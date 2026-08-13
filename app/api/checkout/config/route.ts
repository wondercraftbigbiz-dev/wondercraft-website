import { isMyposConfigured } from '@/lib/mypos/config'
import { isSupabaseConfigured } from '@/lib/supabase/admin'

/**
 * Whether card payment can be offered right now.
 *
 * The landing page is statically prerendered, so a flag computed there is baked
 * in at build time — adding myPOS credentials to the hosting environment later
 * would not take effect until the next deploy. The modal therefore confirms
 * against this dynamic endpoint when it opens.
 *
 * Exposes a single boolean and nothing about why, so it leaks no configuration
 * detail.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET(): Response {
  return Response.json(
    { paymentsEnabled: isMyposConfigured() && isSupabaseConfigured() },
    { headers: { 'cache-control': 'no-store' } },
  )
}
