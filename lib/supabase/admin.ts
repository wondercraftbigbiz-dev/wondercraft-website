import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * The service-role Supabase client.
 *
 * Every table in this project has RLS enabled and **no policies at all**, so
 * anon and authenticated are denied everything by design; `place_order`,
 * `mark_order_paid` and `mark_order_payment_failed` are granted to
 * `service_role` alone (see migration 014). That makes this the only client
 * that can write an order or settle a payment — which is the point: a browser
 * holding the anon key cannot mark its own order paid.
 *
 * Server-only, and never to be imported from a client component.
 */
function requireEnv(name: string): string {
  const value = (process.env[name] ?? '').trim()
  if (!value) {
    throw new Error(`${name} is not set. Orders cannot be written without it.`)
  }
  return value
}

let client: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (!client) {
    client = createClient(
      requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      {
        // No cookies, no refresh: this client is a request-scoped machine
        // identity, never a signed-in person.
        auth: { persistSession: false, autoRefreshToken: false },
      },
    )
  }
  return client
}
