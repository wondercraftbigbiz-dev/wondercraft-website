import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client using the service role key.
 *
 * Every table in this project has RLS enabled with zero policies, and
 * `place_order` / `mark_order_paid` are granted to `service_role` only. That is
 * deliberate: order and payment data is never reachable from the browser.
 *
 * This module must never be imported into a client component. The service role
 * key bypasses RLS entirely — leaking it exposes all customer data.
 */

let cached: SupabaseClient | undefined

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not set.`)
  return value
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  )
}

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    requireEnv('SUPABASE_URL')

  cached = createClient(url, requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return cached
}
