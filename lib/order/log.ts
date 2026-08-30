import 'server-only'

/**
 * Structured logging for the payment path.
 *
 * Deliberately NOT lib/econt/route-helpers.ts's logFailure, for two reasons
 * that both bite exactly when something has gone wrong with money:
 *
 *  1. That function hardcodes `evt: 'econt.failure'`, so a Stripe outage or a
 *     rejected place_order would be filed in the logs under Econt — sending
 *     whoever is debugging a failed payment to the wrong third party.
 *  2. It renders a non-Error as `String(error)`. A Supabase PostgrestError is a
 *     plain object, not an Error, so that produces the literal "[object
 *     Object]" and throws away the message, code, details and hint. The one
 *     log line you need to diagnose a payment failure becomes useless.
 *
 * `scope` names the step that failed, so a log line says which of the four
 * places that talk to Stripe or the database it came from.
 */
export function logPaymentFailure(scope: string, error: unknown): void {
  console.error(
    JSON.stringify({ evt: 'payment.failure', scope, ...describe(error) }),
  )
}

function describe(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message }
  }

  if (error && typeof error === 'object') {
    // Supabase PostgrestError and Stripe's raw error bodies are plain objects.
    // Pull the fields worth having and fall back to a real serialization
    // rather than "[object Object]".
    const e = error as Record<string, unknown>
    const message =
      typeof e.message === 'string' ? e.message : safeStringify(error)
    return {
      message,
      code: e.code ?? undefined,
      details: e.details ?? undefined,
      hint: e.hint ?? undefined,
    }
  }

  return { message: String(error) }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}
