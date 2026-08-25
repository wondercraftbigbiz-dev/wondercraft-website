import 'server-only'

import Stripe from 'stripe'

/**
 * The Stripe SDK, server-side only.
 *
 * STRIPE_SECRET_KEY must never be prefixed NEXT_PUBLIC_ — it is a full account
 * key. Hosted Checkout is why there is no browser SDK anywhere in this app: the
 * customer is redirected to a page Stripe owns, so no card data ever touches
 * ours, and nothing needs a publishable key.
 */

/**
 * Pinned deliberately. Stripe changes response shapes between versions, and an
 * SDK upgrade silently moving the account onto a newer API is exactly the kind
 * of change that breaks a webhook in production rather than in review.
 */
const API_VERSION = '2026-07-29.dahlia'

let stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!stripe) {
    const key = (process.env.STRIPE_SECRET_KEY ?? '').trim()
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
    stripe = new Stripe(key, { apiVersion: API_VERSION })
  }
  return stripe
}

/** The signing secret for the webhook endpoint. Distinct per Stripe mode. */
export function webhookSecret(): string {
  const secret = (process.env.STRIPE_WEBHOOK_SECRET ?? '').trim()
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set')
  return secret
}

/**
 * The public origin, for Checkout's return URLs.
 *
 * Falls back to Vercel's per-deployment host so preview deploys work without
 * their own value; production should set NEXT_PUBLIC_SITE_URL explicitly, since
 * VERCEL_URL is the deployment hostname, not the custom domain.
 */
export function siteUrl(): string {
  const explicit = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim()
  if (explicit) return explicit.replace(/\/+$/, '')
  const vercel = (process.env.VERCEL_URL ?? '').trim()
  if (vercel) return `https://${vercel}`
  return 'http://localhost:3000'
}
