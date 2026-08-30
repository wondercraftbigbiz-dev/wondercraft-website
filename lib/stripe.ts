import 'server-only'

import Stripe from 'stripe'

let stripeClient: Stripe | undefined

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }

  stripeClient ??= new Stripe(process.env.STRIPE_SECRET_KEY)
  return stripeClient
}

export function getAppUrl(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  return new URL(request.url).origin
}

export function toStripeAmount(eurCents: number): number {
  if (!Number.isSafeInteger(eurCents) || eurCents <= 0) {
    throw new Error('Invalid order amount')
  }
  return eurCents
}

export function randomIntegrationSuffix(): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz'
  return Array.from({ length: 8 }, () => letters[Math.floor(Math.random() * letters.length)]).join('')
}
