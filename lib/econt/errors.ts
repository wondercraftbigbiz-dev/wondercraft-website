/**
 * Every failure the Econt integration can produce, reduced to a handful of
 * kinds, each with a Bulgarian message that is safe to show a customer.
 *
 * Upstream error text is kept on the error object for server logs but never
 * reaches the browser — Econt's messages are internal-facing and can carry
 * identifiers we should not publish.
 */
export type EcontErrorKind =
  | 'config' // we are misconfigured (missing credentials, unmeasured parcel)
  | 'network' // could not reach Econt
  | 'timeout' // Econt took too long
  | 'auth' // Econt rejected our credentials
  | 'validation' // Econt rejected the data (bad address, oversized parcel)
  | 'upstream' // Econt returned something we do not understand

export class EcontError extends Error {
  readonly kind: EcontErrorKind
  /** Which form field the customer should fix, when we can tell. */
  readonly field?: string
  /** Upstream detail — for logs only. Never serialize this to a response. */
  readonly detail?: unknown

  constructor(
    kind: EcontErrorKind,
    message: string,
    opts?: { field?: string; detail?: unknown; cause?: unknown },
  ) {
    super(message, { cause: opts?.cause })
    this.name = 'EcontError'
    this.kind = kind
    this.field = opts?.field
    this.detail = opts?.detail
  }
}

export function isEcontError(e: unknown): e is EcontError {
  return e instanceof EcontError
}

const OFFLINE_MESSAGE =
  'Не успяхме да се свържем със системата на Еконт. Опитайте отново след минута или продължете — ще потвърдим доставката по телефон.'

/**
 * The only path from an error to the customer's screen.
 *
 * `auth` deliberately shares wording with `upstream`: telling the world our
 * credentials are wrong helps nobody but an attacker. It is logged distinctly
 * so it can be alerted on.
 */
export function toUserMessageBg(e: unknown): string {
  if (!isEcontError(e)) return OFFLINE_MESSAGE

  switch (e.kind) {
    case 'config':
      return 'Изчисляването на доставката е временно недостъпно. Ще потвърдим цената по телефон.'
    case 'validation':
      // Validation messages are authored by us in Bulgarian at the throw site.
      return e.message
    case 'network':
    case 'timeout':
    case 'auth':
    case 'upstream':
      return OFFLINE_MESSAGE
  }
}

/** True when retrying later might succeed — used to decide log severity. */
export function isTransient(e: unknown): boolean {
  return isEcontError(e) && (e.kind === 'network' || e.kind === 'timeout')
}
