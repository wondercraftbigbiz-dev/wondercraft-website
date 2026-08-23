import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

/**
 * The Supabase client, on the service-role key.
 *
 * The service role bypasses RLS. `public.orders` holds customer names, phone
 * numbers and addresses, and it has RLS enabled with no policies, so this is the
 * only way in — and it must stay the only way in.
 *
 * There is deliberately no anon-key client anywhere in this repo, and no
 * NEXT_PUBLIC_SUPABASE_* variable exists. That absence is the safeguard: with no
 * publishable credential in the bundle, no client path to this table can be
 * created by accident.
 *
 * Returns null rather than throwing when unconfigured. Persistence is not
 * allowed to be the reason an order is refused — callers fall back to logging.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = (process.env.SUPABASE_URL ?? '').trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  if (!url || !key) return null

  client ??= createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'X-Client-Info': 'wondercraft-orders' } },
  })

  return client
}
