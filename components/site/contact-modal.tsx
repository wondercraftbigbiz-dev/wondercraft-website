'use client'

import { useEffect, useReducer, useRef } from 'react'
import { plans, type PlanId } from '@/lib/data/pricing'
import {
  LIMITS,
  hasErrors,
  validateContact,
  validateDelivery,
} from '@/lib/order/schema'
import { findPlan } from '@/lib/data/pricing'
import { DeliverySection } from './checkout/delivery-section'
import { PaymentStep, payButtonLabel } from './checkout/payment-step'
import { usePaymentIntent } from './checkout/use-payment-intent'
import { OrderSummary } from './checkout/order-summary'
import { useShippingQuote } from './checkout/use-shipping-quote'
import {
  initialOrderState,
  orderReducer,
  toOrderDraft,
} from './checkout/order-reducer'
import { AlertIcon, CheckIcon, SpinnerIcon } from './icons'
import { Field } from './field'
import { ModalShell, useModalShell } from './modal-shell'

export function ContactModal({
  initialModel,
  onClose,
}: {
  initialModel: PlanId
  onClose: () => void
}) {
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const [state, dispatch] = useReducer(orderReducer, initialModel, initialOrderState)

  const { errors, planId } = state
  const isCustom = planId === 'custom'
  const submitted = state.submit.status === 'done'
  const plan = findPlan(planId)

  useShippingQuote(state, dispatch)
  usePaymentIntent(state, dispatch)

  const onPayment = state.step === 'payment'
  const paying = state.pay.status === 'confirming'

  // Card is the only payment method, so anything that blocks a card blocks the
  // order outright. Each branch is honest about which it is: a missing quote is
  // something the customer can fix by choosing a destination, a failed quote or
  // an unconfigured Stripe is not, and telling them to call is the only useful
  // instruction left.
  const stripeConfigured = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  const blockedReason = !stripeConfigured
    ? 'Плащането е временно недостъпно. Моля, свържете се с нас, за да поръчате.'
    : state.quote.status === 'error'
      ? 'Не можем да изчислим доставката в момента. Свържете се с нас, за да завършим поръчката.'
      : state.quote.status !== 'ok'
        ? 'Изберете къде да доставим, за да продължите към плащане.'
        : null

  // Two different things, deliberately not one flag. `busy` is why the button
  // cannot be pressed; `working` is whether something is actually happening.
  // A blocked order is not in progress, and spinning at a customer who simply
  // has not chosen a destination yet tells them the site is thinking when it is
  // waiting for them.
  const payFailed = onPayment && state.pay.status === 'error'
  const canRetryPay = payFailed && state.pay.status === 'error' && state.pay.retryable
  const working =
    paying || (onPayment && state.pay.status !== 'ready' && !payFailed)
  const busy = working || Boolean(blockedReason) || (payFailed && !canRetryPay)

  const buttonLabel = paying
    ? 'Потвърждаваме…'
    : canRetryPay
      ? 'Опитайте отново'
      : payFailed
        ? 'Плащането е недостъпно'
        : onPayment
          ? state.pay.status === 'ready'
            ? payButtonLabel({
                cents: state.pay.total.cents,
                currency: state.pay.total.currency,
              })
            : 'Подготвяме плащането…'
          : 'Продължи към плащане'

  /**
   * Start the payment over on a fresh attempt.
   *
   * A new attempt id changes intentKey(), which is what re-fires the effect that
   * opens a PaymentIntent. Reusing the old id would find the previous attempt
   * and hand back the intent that just failed.
   */
  function retryPayment() {
    dispatch({ type: 'goToPayment', attemptId: crypto.randomUUID() })
  }

  // Move focus into the dialog on open.
  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  function handlePaid(orderRef: string) {
    dispatch({ type: 'submitOk', orderRef })
  }

  /**
   * Validate the details, then move to payment.
   *
   * Nothing is submitted here any more. The order is created, priced and
   * charged by /api/payment/intent, which the payment step drives — so this
   * step's only job is to refuse to advance on data the server would reject
   * anyway.
   */
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (onPayment || blockedReason) return

    const draft = toOrderDraft(state)
    const next = { ...validateContact(draft), ...validateDelivery(draft.delivery) }
    dispatch({ type: 'setErrors', errors: next })
    if (hasErrors(next)) return

    dispatch({ type: 'goToPayment', attemptId: crypto.randomUUID() })
  }

  return (
    <ModalShell
      title={submitted ? 'Благодарим ви!' : onPayment ? 'Плащане' : 'Поръчай сега'}
      onClose={onClose}
      // Locked while Stripe has the payment, including the 3DS window.
      dismissible={!paying}
      aside={
        submitted ? undefined : (
          // Sticky so the total and the button stay in view if the column
          // itself has to scroll — a quote error adds a paragraph below.
          <div className="lg:sticky lg:top-0">
            <OrderSummary
              productEurCents={plan?.priceEurCents ?? 0}
              quote={state.quote}
            />
            {!onPayment && blockedReason && (
              <p className="mt-4 rounded-md border border-border-soft bg-kraft/30 px-4 py-3 text-sm leading-relaxed text-charcoal-soft">
                {blockedReason}
              </p>
            )}
            {state.pay.status === 'error' && (
              <p
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-md border border-salmon-deep bg-salmon/25 px-4 py-3 text-sm leading-relaxed text-charcoal"
              >
                <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                {state.pay.message}
              </p>
            )}
            {/* One button, three jobs. It stays a single node in the aside and
                reaches whichever form is showing through form="…", the same
                mechanism the details form already used to span the CSS layout
                split. Rendering a second button for the payment step would
                duplicate this column, and with it OrderSummary's aria-live
                region — see the note in modal-shell.tsx. */}
            <button
              type={canRetryPay ? 'button' : 'submit'}
              form={canRetryPay ? undefined : onPayment ? 'payment-form' : 'order-form'}
              onClick={canRetryPay ? retryPayment : undefined}
              disabled={busy}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-border-soft bg-salmon px-6 py-3 font-sans text-base font-semibold text-charcoal shadow-soft transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-salmon-hover hover:shadow-soft-lg active:scale-[0.96] active:duration-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:scale-100"
            >
              {working && (
                <SpinnerIcon className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {buttonLabel}
            </button>

            {onPayment ? (
              <button
                type="button"
                onClick={() => dispatch({ type: 'backToDetails' })}
                disabled={paying}
                className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-transparent px-6 py-2 font-sans text-sm font-semibold text-charcoal-soft underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:no-underline"
              >
                Промени данните
              </button>
            ) : (
              <p className="mt-3 text-center text-sm text-charcoal-soft">
                Плащането е защитено и се обработва от Stripe.
              </p>
            )}
          </div>
        )
      }
    >
      {submitted ? (
        <SuccessPanel
          orderRef={
            state.submit.status === 'done' ? state.submit.orderRef : ''
          }
          email={state.email}
        />
      ) : (
        // One scroll container holding two SIBLING forms. The payment form
        // cannot be nested inside the details form: nested <form> elements are
        // invalid HTML and the browser drops the inner one, which would leave
        // the pay button submitting nothing.
        <div
          // flex-1 covers the stacked layout; the explicit placement is for the
          // lg grid, where flex sizing no longer applies.
          className="min-h-0 flex-1 overflow-y-auto px-6 py-5 lg:col-start-1 lg:row-start-2"
        >
          <form id="order-form" onSubmit={handleSubmit} noValidate>
          {/* Frozen once the payment step opens. Name, phone and address do not
              change the amount, but they were written to the order row before
              Stripe was called, so letting them change underneath a live
              PaymentIntent would leave the row describing a different order than
              the one being paid for. A fieldset disables the whole subtree
              without threading a prop through every child. */}
          <fieldset disabled={onPayment} className="contents">
          <div className="flex flex-col gap-4">
            <Field label="Име" error={errors.name}>
              {({ describedBy, hasError }) => (
                <input
                  ref={firstFieldRef}
                  name="name"
                  type="text"
                  autoComplete="name"
                  maxLength={LIMITS.name}
                  className="modal-input"
                  value={state.name}
                  aria-invalid={hasError || undefined}
                  aria-describedby={describedBy}
                  onChange={(e) =>
                    dispatch({ type: 'setText', field: 'name', value: e.target.value })
                  }
                />
              )}
            </Field>

            <Field label="Телефон" error={errors.phone}>
              {({ describedBy, hasError }) => (
                <input
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  className="modal-input"
                  value={state.phone}
                  aria-invalid={hasError || undefined}
                  aria-describedby={describedBy}
                  onChange={(e) =>
                    dispatch({ type: 'setText', field: 'phone', value: e.target.value })
                  }
                />
              )}
            </Field>

            <Field label="Имейл" error={errors.email}>
              {({ describedBy, hasError }) => (
                <input
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  maxLength={LIMITS.email}
                  className="modal-input"
                  value={state.email}
                  aria-invalid={hasError || undefined}
                  aria-describedby={describedBy}
                  onChange={(e) =>
                    dispatch({ type: 'setText', field: 'email', value: e.target.value })
                  }
                />
              )}
            </Field>

            <Field label="Модел" error={errors.model}>
              {({ describedBy, hasError }) => (
                <select
                  name="model"
                  className="modal-input"
                  value={planId}
                  aria-invalid={hasError || undefined}
                  aria-describedby={describedBy}
                  onChange={(e) =>
                    dispatch({ type: 'setPlan', planId: e.target.value as PlanId })
                  }
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.euro} ({p.lev})
                    </option>
                  ))}
                </select>
              )}
            </Field>

            {isCustom && (
              <>
                <Field label="Име за печат" error={errors.printName}>
                  {({ describedBy, hasError }) => (
                    <input
                      name="printName"
                      type="text"
                      maxLength={LIMITS.printName}
                      className="modal-input"
                      value={state.printName}
                      aria-invalid={hasError || undefined}
                      aria-describedby={describedBy}
                      onChange={(e) =>
                        dispatch({
                          type: 'setText',
                          field: 'printName',
                          value: e.target.value,
                        })
                      }
                    />
                  )}
                </Field>
                <Field label="Допълнителна персонализация" error={errors.customization}>
                  {({ describedBy }) => (
                    <textarea
                      name="customization"
                      rows={2}
                      maxLength={LIMITS.customization}
                      className="modal-input resize-none"
                      value={state.customization}
                      aria-describedby={describedBy}
                      onChange={(e) =>
                        dispatch({
                          type: 'setText',
                          field: 'customization',
                          value: e.target.value,
                        })
                      }
                    />
                  )}
                </Field>
              </>
            )}

            <hr className="border-border-soft" />

            <DeliverySection state={state} dispatch={dispatch} />

            <hr className="border-border-soft" />

            <Field label="Съобщение (по избор)" error={errors.message}>
              {({ describedBy }) => (
                <textarea
                  name="message"
                  rows={2}
                  maxLength={LIMITS.message}
                  className="modal-input resize-none"
                  value={state.message}
                  aria-describedby={describedBy}
                  onChange={(e) =>
                    dispatch({ type: 'setText', field: 'message', value: e.target.value })
                  }
                />
              )}
            </Field>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed text-charcoal-soft">
              <input
                name="marketingConsent"
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-salmon-deep"
                checked={state.marketingConsent}
                onChange={(e) =>
                  dispatch({ type: 'setMarketingConsent', value: e.target.checked })
                }
              />
              Искам да получавам новини и оферти по имейл. Може да се отпишете по
              всяко време.
            </label>
          </div>
          </fieldset>
          </form>

          {onPayment && (
            <div className="mt-5 border-t border-border-soft pt-5">
              <PaymentStep state={state} dispatch={dispatch} onPaid={handlePaid} />
            </div>
          )}
        </div>
      )}
    </ModalShell>
  )
}

function SuccessPanel({
  orderRef,
  email,
}: {
  orderRef: string
  email: string
}) {
  const { requestClose } = useModalShell()

  return (
    <div className="px-6 py-10 text-center">
      <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-border-soft bg-salmon">
        <CheckIcon className="h-7 w-7 text-charcoal" aria-hidden="true" />
      </span>
      <p className="mt-5 text-pretty text-base leading-relaxed text-charcoal">
        Плащането е успешно. Ще се свържем с вас, за да потвърдим доставката.
      </p>
      {email && (
        <p className="mt-2 text-sm text-charcoal-soft">
          Изпратихме разписка на{' '}
          <span className="font-semibold text-charcoal">{email}</span>.
        </p>
      )}
      {orderRef && (
        <p className="mt-4 text-sm text-charcoal-soft">
          Номер на поръчката:{' '}
          <span className="font-sans font-semibold tabular-nums text-charcoal">
            {orderRef}
          </span>
        </p>
      )}
      <button
        type="button"
        onClick={requestClose}
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md border border-border-soft bg-transparent px-6 py-3 font-sans text-base font-semibold text-charcoal"
      >
        Затвори
      </button>
    </div>
  )
}
