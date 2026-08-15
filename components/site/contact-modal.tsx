'use client'

import { useEffect, useId, useReducer, useRef } from 'react'
import { plans, type PlanId } from '@/lib/data/pricing'
import {
  LIMITS,
  hasErrors,
  validateContact,
  validateDelivery,
  type CheckoutMode,
} from '@/lib/order/schema'
import { formatMoney, orderTotal } from '@/lib/money'
import type { OrderResponse } from '@/lib/econt/dto'
import { findPlan } from '@/lib/data/pricing'
import { DeliverySection } from './checkout/delivery-section'
import { OrderSummary } from './checkout/order-summary'
import {
  initialOrderState,
  orderReducer,
  toOrderDraft,
} from './checkout/order-reducer'
import { AlertIcon, CheckIcon, ShieldIcon, SpinnerIcon } from './icons'
import { Field } from './field'
import { ModalShell, useModalShell } from './modal-shell'
import { QuantityStepper } from './quantity-stepper'

export function ContactModal({
  initialModel,
  paymentsEnabled,
  onClose,
}: {
  initialModel: PlanId
  /** Whether myPOS and Supabase are both configured. Resolved server-side. */
  paymentsEnabled: boolean
  onClose: () => void
}) {
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const quantityLabelId = useId()
  const [state, dispatch] = useReducer(orderReducer, initialModel, initialOrderState)

  const { errors, planId } = state
  const isCustom = planId === 'custom'
  const submitted = state.submit.status === 'done'
  // 'redirecting' keeps the form locked: a full navigation to myPOS follows, and
  // re-enabling the buttons would invite a second order.
  const busy =
    state.submit.status === 'submitting' || state.submit.status === 'redirecting'
  const submitting = busy
  const plan = findPlan(planId)
  const total = orderTotal(plan?.priceEurCents ?? 0, state.quantity)

  // Enter in the form takes the primary action.
  const defaultMode: CheckoutMode = paymentsEnabled ? 'pay' : 'contact'

  // Move focus into the dialog on open.
  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  /**
   * Hands the browser off to the myPOS hosted page.
   *
   * myPOS accepts a purchase only as an HTML form POST, so we build one from the
   * server-signed fields and submit it as a top-level navigation. No
   * window.open, so popup blockers are not involved.
   */
  function postToMypos(action: string, fields: Record<string, string>) {
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = action
    form.acceptCharset = 'UTF-8'
    form.style.display = 'none'

    for (const [name, value] of Object.entries(fields)) {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = value
      form.appendChild(input)
    }

    document.body.appendChild(form)
    form.submit()
  }

  async function submit(mode: CheckoutMode) {
    if (busy) return

    const draft = { ...toOrderDraft(state), mode }
    const next = { ...validateContact(draft), ...validateDelivery(draft.delivery) }
    dispatch({ type: 'setErrors', errors: next })
    if (hasErrors(next)) return

    dispatch({ type: 'submitStart', mode })
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const body = (await res.json()) as OrderResponse

      if (body.ok) {
        if (body.payment) {
          dispatch({ type: 'submitRedirecting' })
          postToMypos(body.payment.action, body.payment.fields)
          return
        }
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    await submit(defaultMode)
  }

  return (
    <ModalShell
      title={submitted ? 'Благодарим ви!' : 'Поръчай сега'}
      onClose={onClose}
      aside={
        submitted ? undefined : (
          // Sticky so the total and the buttons stay in view if the column
          // itself has to scroll.
          <div className="lg:sticky lg:top-0">
            <OrderSummary
              unitPriceEurCents={plan?.priceEurCents ?? 0}
              quantity={state.quantity}
            />

            {state.submit.status === 'error' && (
              <p
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-md border border-salmon-deep bg-salmon/25 px-4 py-3 text-sm leading-relaxed text-charcoal"
              >
                <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                {state.submit.message}
              </p>
            )}

            <button
              type="submit"
              form="order-form"
              disabled={busy}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-border-soft bg-salmon px-6 py-3 font-sans text-base font-semibold text-charcoal shadow-soft transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-salmon-hover hover:shadow-soft-lg active:scale-[0.96] active:duration-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:scale-100"
            >
              {busy && (
                <SpinnerIcon className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {primaryLabel(paymentsEnabled, state.submit.status, formatMoney(total))}
            </button>

            {paymentsEnabled ? (
              <>
                <p className="mt-2.5 flex items-start justify-center gap-2 text-center text-sm leading-relaxed text-charcoal-soft">
                  <ShieldIcon
                    className="mt-0.5 h-4 w-4 shrink-0 text-salmon-deep"
                    aria-hidden="true"
                  />
                  <span>
                    Сигурно плащане чрез myPOS. Не съхраняваме данни от картата ви.
                  </span>
                </p>

                <div className="my-3 flex items-center gap-3" aria-hidden="true">
                  <span className="h-px flex-1 bg-border-soft" />
                  <span className="font-sans text-xs uppercase tracking-wider text-charcoal-soft">
                    или
                  </span>
                  <span className="h-px flex-1 bg-border-soft" />
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submit('contact')}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-border-soft bg-transparent px-6 py-3 font-sans text-base font-semibold text-charcoal transition-all duration-200 hover:bg-charcoal/5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Свържете се с мен вместо това
                </button>
              </>
            ) : (
              <p className="mt-3 text-center text-sm text-charcoal-soft">
                Ще се свържем с вас, за да потвърдим детайлите.
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
        />
      ) : (
        <form
          id="order-form"
          onSubmit={handleSubmit}
          noValidate
          // flex-1 covers the stacked layout; the explicit placement is for the
          // lg grid, where flex sizing no longer applies.
          className="min-h-0 flex-1 overflow-y-auto px-6 py-5 lg:col-start-1 lg:row-start-2"
        >
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

            <div>
              <span
                id={quantityLabelId}
                className="mb-1.5 block font-sans text-sm font-semibold text-charcoal"
              >
                Количество
              </span>
              <QuantityStepper
                value={state.quantity}
                onChange={(value) => dispatch({ type: 'setQuantity', value })}
                disabled={busy}
                labelId={quantityLabelId}
              />
              {errors.quantity && (
                <span className="mt-1 block text-sm font-medium text-salmon-deep">
                  {errors.quantity}
                </span>
              )}
            </div>

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

            {paymentsEnabled && (
              <Consent
                checked={state.acceptTerms}
                error={errors.acceptTerms}
                onChange={(value) =>
                  dispatch({ type: 'setCheckbox', field: 'acceptTerms', value })
                }
              >
                Приемам{' '}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noreferrer"
                  className="link-underline font-medium text-charcoal hover:text-salmon-deep"
                >
                  общите условия
                </a>{' '}
                и{' '}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="link-underline font-medium text-charcoal hover:text-salmon-deep"
                >
                  политиката за поверителност
                </a>
                .
              </Consent>
            )}

            <Consent
              checked={state.marketingConsent}
              onChange={(value) =>
                dispatch({ type: 'setCheckbox', field: 'marketingConsent', value })
              }
            >
              Искам да получавам новини и промоции по имейл. (по избор)
            </Consent>

            {/* Honeypot. Hidden from people, tempting to bots. Off-screen rather
                than display:none, so bots that skip hidden inputs still fill it. */}
            <div aria-hidden="true" className="honeypot">
              <label>
                Уебсайт
                <input name="website" type="text" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
          </div>

        </form>
      )}
    </ModalShell>
  )
}

function SuccessPanel({ orderRef }: { orderRef: string }) {
  const { requestClose } = useModalShell()

  return (
    <div className="px-6 py-10 text-center">
      <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-border-soft bg-salmon">
        <CheckIcon className="h-7 w-7 text-charcoal" aria-hidden="true" />
      </span>
      <p className="mt-5 text-pretty text-base leading-relaxed text-charcoal">
        Получихме заявката ви. Ще се свържем с вас възможно най-скоро, за да
        потвърдим поръчката и доставката.
      </p>
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

/**
 * The primary button's label.
 *
 * With payments on it names the amount, because a button that says what it will
 * charge is the clearest possible consent to charge it.
 */
function primaryLabel(
  paymentsEnabled: boolean,
  status: string,
  total: string,
): string {
  if (status === 'redirecting') return 'Пренасочваме ви…'
  if (status === 'submitting') return 'Изпращаме…'
  return paymentsEnabled ? `Плати онлайн — ${total}` : 'Поръчай сега'
}

function Consent({
  checked,
  error,
  onChange,
  children,
}: {
  checked: boolean
  error?: string
  onChange: (next: boolean) => void
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.checked)}
          className="modal-checkbox"
        />
        <span className="font-sans text-sm leading-relaxed text-charcoal-soft">
          {children}
        </span>
      </label>
      {error && (
        <span className="mt-1 block text-sm font-medium text-salmon-deep">{error}</span>
      )}
    </div>
  )
}
