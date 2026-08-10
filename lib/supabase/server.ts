// Server-only Supabase client.
//
// Uses the service role key, which bypasses row level security. Every table in
// this project has RLS enabled with no policies, so this client is the *only*
// way anything reads or writes customer data — the browser cannot, by design.
//
// The `server-only` import makes an accidental client-side import a build
// error rather than a leaked key.
import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached

  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.',
    )
  }

  cached = createClient(url, serviceRoleKey, {
    auth: {
      // No user sessions here; this is a trusted server-to-server client.
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return cached
}
