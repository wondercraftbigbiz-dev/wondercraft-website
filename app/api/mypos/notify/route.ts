import { getMyposConfig } from '@/lib/mypos/config'
import { parseNotification, readNotificationDetails } from '@/lib/mypos/parse-notify'
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/server'

/**
 * myPOS IPCPurchaseNotify endpoint (URL_Notify).
 *
 * This is the ONLY thing that marks an order paid. A browser arriving at
 * URL_OK proves nothing — anyone can type that URL.
 *
 * Response contract: myPOS expects HTTP 200 with a body of exactly "OK".
 * Anything else is treated as a communication error, retried, and can cause the
 * transaction to be reversed. So "OK" means "we have durably handled this", and
 * we return a non-200 only when a retry could plausibly succeed.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function ok(): Response {
  return new Response('OK', {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}

function fail(status: number, reason: string): Response {
  return new Response(reason, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}

export async function POST(request: Request): Promise<Response> {
  let config
  try {
    config = getMyposConfig()
  } catch (cause) {
    // Misconfiguration on our side: a retry may succeed once env vars land.
    console.error('[mypos:notify] configuration error', cause)
    return fail(500, 'config error')
  }

  const rawBody = await request.text()
  const parsed = parseNotification(rawBody, config)

  if (!parsed.verified) {
    // Never acknowledge an unverified payload — acknowledging would let anyone
    // silence the real notification by racing it with a forgery.
    console.error('[mypos:notify] signature verification FAILED', {
      fieldNames: parsed.fields.map(([name]) => name),
    })
    return fail(400, 'invalid signature')
  }

  const details = readNotificationDetails(parsed.values)

  if (details.sid !== config.sid) {
    console.error('[mypos:notify] SID mismatch', { received: details.sid })
    return fail(400, 'unknown store')
  }

  if (!details.orderId) {
    console.error('[mypos:notify] missing OrderID', { method: details.method })
    return fail(400, 'missing order id')
  }

  // Checked after authentication so an unverified caller learns nothing about
  // our configuration state.
  if (!isSupabaseConfigured()) {
    console.error('[mypos:notify] Supabase is not configured')
    return fail(500, 'config error')
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .rpc('mark_order_paid', {
      p_mypos_order_id: details.orderId,
      p_trnref: details.trnref || null,
      p_amount: details.amount,
      p_currency: details.currency,
      p_raw: parsed.values,
    })
    .single<{ result: string; order_id: string | null; order_number: number | null }>()

  if (error || !data) {
    // Database trouble is transient by nature; let myPOS retry.
    console.error('[mypos:notify] mark_order_paid failed', error)
    return fail(500, 'storage error')
  }

  switch (data.result) {
    case 'paid':
      console.info('[mypos:notify] settled', {
        orderNumber: data.order_number,
        reference: details.orderId,
      })
      return ok()

    case 'already_paid':
      // myPOS retries until acknowledged; a duplicate is expected, not an error.
      return ok()

    case 'amount_mismatch':
      // Flagged on the order for manual review. Retrying cannot change the
      // amount, so a retry loop would be pure noise — acknowledge and alert.
      console.error('[mypos:notify] AMOUNT MISMATCH — order flagged for review', {
        orderNumber: data.order_number,
        reference: details.orderId,
        notifiedAmount: details.amount,
        notifiedCurrency: details.currency,
      })
      return ok()

    case 'not_found':
      // No order carries this reference. Could be a race with our own insert,
      // so let myPOS retry rather than swallowing a real payment.
      console.error('[mypos:notify] no order for reference', {
        reference: details.orderId,
      })
      return fail(404, 'unknown order')

    default:
      console.error('[mypos:notify] unexpected result', data)
      return fail(500, 'unexpected result')
  }
}

/**
 * myPOS is expected to POST. A GET is almost always a human or a monitor
 * checking the URL is reachable, so answer plainly without touching anything.
 */
export function GET(): Response {
  return new Response('myPOS notify endpoint. POST only.', {
    status: 405,
    headers: { 'content-type': 'text/plain; charset=utf-8', allow: 'POST' },
  })
}
