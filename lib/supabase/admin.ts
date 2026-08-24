import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role client for order/payment writes.
 *
 * The RPCs this calls (`place_order`, `mark_order_paid`) are no longer
 * grantable to `anon`/`authenticated` — see migration
 * 014_restrict_payment_rpc_grants — so only this client, holding the service
 * role key, can call them. Never import this from a client component; the
 * key it reads bypasses row-level security entirely.
 */
let client: SupabaseClient | undefined

export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client

  const url = (process.env.SUPABASE_URL ?? '').trim()
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()

  const missing: string[] = []
  if (!url) missing.push('SUPABASE_URL')
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (missing.length > 0) {
    throw new Error(`Supabase is misconfigured: missing ${missing.join(', ')}`)
  }

  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}
