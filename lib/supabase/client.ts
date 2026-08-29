'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser-side Supabase client, singleton.
 *
 * Reads the public anon key and project URL from .env — both are safe to expose
 * to the browser. Used for auth (signIn, signUp, session) and reading the
 * user's own orders/subscriptions through RLS-scoped views.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
