import 'server-only'

import { Resend } from 'resend'

let client: Resend | undefined

export function getResend(): Resend {
  if (client) return client

  const apiKey = (process.env.RESEND_API_KEY ?? '').trim()
  if (!apiKey) {
    throw new Error('Resend is misconfigured: missing RESEND_API_KEY')
  }

  client = new Resend(apiKey)
  return client
}
