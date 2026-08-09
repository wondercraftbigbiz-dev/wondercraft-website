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
import { OrderSummary } from './checkout/order-summary'
import { useShippingQuote } from './checkout/use-shipping-quote'
import {
  initialOrderState,
  orderReducer,
  toOrderDraft,
} from './checkout/order-reducer'
import { CheckIcon } from './icons'
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

  // Move focus into the dialog on open.
  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const draft = toOrderDraft(state)
    const next = { ...validateContact(draft), ...validateDelivery(draft.delivery) }

    dispatch({ type: 'setErrors', errors: next })
    if (!hasErrors(next)) {
      // Prototype: nothing is sent yet. Show the fake success state.
      dispatch({ type: 'submitOk', orderRef: '' })
    }
  }

  return (
    <ModalShell
      title={submitted ? 'Благодарим ви!' : 'Поръчай сега'}
      onClose={onClose}
      footer={
        submitted ? undefined : (
          <>
            <OrderSummary
              productEurCents={plan?.priceEurCents ?? 0}
              quote={state.quote}
            />
            <button
              type="submit"
              form="order-form"
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border-soft bg-salmon px-6 py-3 font-sans text-base font-semibold text-charcoal shadow-soft transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-salmon-hover hover:shadow-soft-lg active:scale-[0.96] active:duration-100"
            >
              Поръчай сега
            </button>
            <p className="mt-3 text-center text-sm text-charcoal-soft">
              Ще се свържем с вас, за да потвърдим детайлите.
            </p>
          </>
        )
      }
    >
      {submitted ? (
        <SuccessPanel />
      ) : (
        <form
          id="order-form"
          onSubmit={handleSubmit}
          noValidate
          className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
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
          </div>

        </form>
      )}
    </ModalShell>
  )
}

function SuccessPanel() {
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
