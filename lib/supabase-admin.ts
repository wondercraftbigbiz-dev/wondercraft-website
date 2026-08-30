import 'server-only'

import { createClient } from '@supabase/supabase-js'

let client: any

export function getSupabaseAdmin(): any {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase server credentials are not configured')
  client ??= createClient<any>(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  return client
}
