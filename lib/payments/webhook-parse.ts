// Narrowing for webhook payloads.
//
// The signature check in the route proves the event came from Stripe, and the
// SDK hands back a typed Stripe.Event — but "typed" is not "safe to index".
// amount_received is nullable, every metadata value is `string | undefined`, and
// charge.payment_intent is either an id or an expanded object depending on the
// event. Each of those is a runtime shape this code has to survive, so it is
// checked here rather than asserted at the call site.
//
// Hand-rolled rather than zod, matching the note in lib/order/schema.ts: there
// is no user to show a message to and no field to attribute, so the validator
// shape there does not fit. Never throws — a malformed event returns null and
// the route acknowledges it rather than making Stripe retry forever.

export type IntentEvent = {
  intentId: string
  orderRef: string | null
  attemptId: string | null
  amountCents: number | null
  currency: string | null
  failureCode: string | null
  failureMessage: string | null
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

function int(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null
}

function obj(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null
}

/** A payment_intent.* event. Returns null if the shape is not what we expect. */
export function readIntentEvent(dataObject: unknown): IntentEvent | null {
  const o = obj(dataObject)
  if (!o) return null

  const intentId = str(o.id)
  if (!intentId) return null

  const metadata = obj(o.metadata) ?? {}
  const lastError = obj(o.last_payment_error)

  return {
    intentId,
    orderRef: str(metadata.orderRef),
    attemptId: str(metadata.attemptId),
    // amount_received is 0 until capture and null on some failures; fall back to
    // the intended amount so a mismatch check still has something to compare.
    amountCents: int(o.amount_received) ?? int(o.amount),
    currency: str(o.currency)?.toUpperCase() ?? null,
    failureCode: lastError ? str(lastError.code) : null,
    failureMessage: lastError ? str(lastError.message) : null,
  }
}

/**
 * A charge.refunded event, reduced to the intent it belongs to.
 *
 * `payment_intent` arrives as a bare id most of the time and as an expanded
 * object when the endpoint requested expansion, so both are handled.
 */
export function readChargeRefund(
  dataObject: unknown,
): { intentId: string; refundedCents: number } | null {
  const o = obj(dataObject)
  if (!o) return null

  const pi = o.payment_intent
  const intentId = str(pi) ?? str(obj(pi)?.id)
  if (!intentId) return null

  return { intentId, refundedCents: int(o.amount_refunded) ?? 0 }
}
