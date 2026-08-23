/**
 * Every failure the Stripe integration can produce, reduced to a handful of
 * kinds, each with a Bulgarian message that is safe to show a customer.
 *
 * Deliberately mirrors lib/econt/errors.ts, including the rule that upstream
 * text is kept for logs and never reaches the browser. Stripe's messages are
 * mostly customer-safe, but its decline reasons can leak issuer detail we have
 * no business republishing.
 */
export type PaymentErrorKind =
  | 'config' // we are misconfigured (missing keys)
  | 'disabled' // payments are switched off for this environment
  | 'no_quote' // delivery could not be priced, so there is no amount to charge
  | 'repriced' // the total moved between the quote and the charge
  | 'network' // could not reach Stripe
  | 'upstream' // Stripe returned something we do not understand

export class PaymentError extends Error {
  readonly kind: PaymentErrorKind
  /** Upstream detail — for logs only. Never serialize this to a response. */
  readonly detail?: unknown

  constructor(
    kind: PaymentErrorKind,
    message: string,
    opts?: { detail?: unknown; cause?: unknown },
  ) {
    super(message, { cause: opts?.cause })
    this.name = 'PaymentError'
    this.kind = kind
    this.detail = opts?.detail
  }
}

export function isPaymentError(e: unknown): e is PaymentError {
  return e instanceof PaymentError
}

const FALLBACK =
  'Плащането е временно недостъпно. Опитайте отново след малко или ни се обадете.'

/**
 * The only path from an error to the customer's screen.
 *
 * `config` and `disabled` share wording with `upstream` on purpose: a customer
 * cannot act on our misconfiguration, and with card as the only payment method
 * the only useful instruction is the same in all three cases — try later, or
 * call. They are logged distinctly so they can be alerted on.
 */
export function toPaymentMessageBg(e: unknown): string {
  if (!isPaymentError(e)) return FALLBACK

  switch (e.kind) {
    case 'no_quote':
      return 'Не успяхме да изчислим цената за доставка, затова не можем да приемем поръчката. Опитайте отново или ни се обадете.'
    case 'repriced':
      return 'Цената на доставката се промени. Проверете новата сума и потвърдете.'
    case 'network':
      return 'Връзката с платежната система прекъсна. Проверете интернет връзката и опитайте отново.'
    case 'config':
    case 'disabled':
    case 'upstream':
      return FALLBACK
  }
}
