'use client'

import { useEffect, useReducer, useRef } from 'react'
import { plans, type PlanId } from '@/lib/data/pricing'
import {
  LIMITS,
  hasErrors,
  validateContact,
  validateDelivery,
} from '@/lib/order/schema'
import type { OrderResponse } from '@/lib/econt/dto'
import { findPlan } from '@/lib/data/pricing'
import { DeliverySection } from './checkout/delivery-section'
import { PaymentMethodSelect } from './checkout/payment-method-select'
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
  const submitting = state.submit.status === 'submitting'
  const plan = findPlan(planId)

  useShippingQuote(state, dispatch)
  usePaymentIntent(state, dispatch)

  // Card needs two things the rest of the form does not: Stripe configured, and
  // a delivery price. Without a quote there is no total, and a card cannot be
  // charged for an amount nobody has computed — so the option is offered with a
  // reason rather than silently doing nothing. Cash on delivery has neither
  // requirement, which is why it stays the default.
  const stripeConfigured = Boolean(
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  )
  const onPayment = state.step === 'payment'
  const paying = state.pay.status === 'confirming'
  // The payment step's button must not be pressable until Stripe has actually
  // issued a client secret, or it would submit an element that is not mounted.
  const busy =
    submitting || paying || (onPayment && state.pay.status !== 'ready')
  const buttonLabel = submitting
    ? 'Изпращаме…'
    : paying
      ? 'Потвърждаваме…'
      : onPayment
        ? state.pay.status === 'ready'
          ? payButtonLabel({
              cents: state.pay.total.cents,
              currency: state.pay.total.currency,
            })
          : 'Подготвяме плащането…'
        : state.paymentMethod === 'card'
          ? 'Продължи към плащане'
          : 'Поръчай сега'
  const cardDisabledReason = !stripeConfigured
    ? 'Плащането с карта е временно недостъпно.'
    : state.quote.status !== 'ok'
      ? 'Изберете къде да доставим, за да платите с карта.'
      : null

  // Move focus into the dialog on open.
  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  // A customer can pick card while a quote is live and then change the
  // destination, which drops the quote and takes card with it. Leaving the
  // selection on a disabled option would strand them on a step that cannot
  // proceed, so fall back to the method that always works.
  useEffect(() => {
    if (cardDisabledReason && state.paymentMethod === 'card') {
      dispatch({ type: 'setPaymentMethod', value: 'cod' })
    }
  }, [cardDisabledReason, state.paymentMethod])

  function handlePaid(orderRef: string) {
    dispatch({ type: 'submitOk', orderRef })
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return

    const draft = toOrderDraft(state)
    const next = { ...validateContact(draft), ...validateDelivery(draft.delivery) }
    dispatch({ type: 'setErrors', errors: next })
    if (hasErrors(next)) return

    // Card orders are not placed here. They are priced, recorded and charged by
    // /api/payment/intent, which the payment step drives.
    if (state.paymentMethod === 'card') {
      dispatch({ type: 'goToPayment', attemptId: crypto.randomUUID() })
      return
    }

    dispatch({ type: 'submitStart' })
    try {
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const body = (await res.json()) as OrderResponse

      if (body.ok) {
        dispatch({ type: 'submitOk', orderRef: body.orderRef })
        return
      }

      // The server re-runs the same validator, so its field errors render
      // through exactly the same error record as the client's own.
      if (body.errors) dispatch({ type: 'setErrors', errors: body.errors })
      else if (body.field) {
        dispatch({ type: 'setErrors', errors: { [body.field]: body.message } as never })
      }
      dispatch({ type: 'submitError', message: body.message })
    } catch {
      dispatch({
        type: 'submitError',
        message:
          'Нещо се обърка при изпращането. Проверете връзката и опитайте отново.',
      })
    }
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
            {state.pay.status === 'error' && (
              <p
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-md border border-salmon-deep bg-salmon/25 px-4 py-3 text-sm leading-relaxed text-charcoal"
              >
                <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                {state.pay.message}
              </p>
            )}
            {state.submit.status === 'error' && (
              <p
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-md border border-salmon-deep bg-salmon/25 px-4 py-3 text-sm leading-relaxed text-charcoal"
              >
                <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                {state.submit.message}
              </p>
            )}
            {/* One button, three jobs. It stays a single node in the aside and
                reaches whichever form is showing through form="…", the same
                mechanism the details form already used to span the CSS layout
                split. Rendering a second button for the payment step would
                duplicate this column, and with it OrderSummary's aria-live
                region — see the note in modal-shell.tsx. */}
            <button
              type="submit"
              form={onPayment ? 'payment-form' : 'order-form'}
              disabled={busy}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-border-soft bg-salmon px-6 py-3 font-sans text-base font-semibold text-charcoal shadow-soft transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-salmon-hover hover:shadow-soft-lg active:scale-[0.96] active:duration-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:scale-100"
            >
              {busy && (
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
                {state.paymentMethod === 'card'
                  ? 'Плащането е защитено и се обработва от Stripe.'
                  : 'Ще се свържем с вас, за да потвърдим детайлите.'}
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
          paid={state.paymentMethod === 'card'}
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

            <PaymentMethodSelect
              value={state.paymentMethod}
              onChange={(value) => dispatch({ type: 'setPaymentMethod', value })}
              disabled={cardDisabledReason ? { card: cardDisabledReason } : undefined}
              error={errors.paymentMethod}
            />

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
  paid,
  email,
}: {
  orderRef: string
  paid: boolean
  email: string
}) {
  const { requestClose } = useModalShell()

  return (
    <div className="px-6 py-10 text-center">
      <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-border-soft bg-salmon">
        <CheckIcon className="h-7 w-7 text-charcoal" aria-hidden="true" />
      </span>
      <p className="mt-5 text-pretty text-base leading-relaxed text-charcoal">
        {paid
          ? 'Плащането е успешно. Ще се свържем с вас, за да потвърдим доставката.'
          : 'Получихме заявката ви. Ще се свържем с вас възможно най-скоро, за да потвърдим поръчката и доставката.'}
      </p>
      {paid && email && (
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
