'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  validateCheckout,
  type CheckoutErrors,
  type CheckoutMode,
} from '@/lib/checkout/validate'
import {
  formatBgn,
  formatEur,
  eurToBgn,
  getPlan,
  orderTotalEur,
  plans,
  type Plan,
} from '@/lib/data/pricing'
import { CheckIcon, CloseIcon, ShieldIcon } from './icons'
import { QuantityStepper } from './quantity-stepper'

type Outcome = { kind: 'contact'; orderNumber?: number }

export function ContactModal({
  initialModel,
  paymentsEnabled,
  onClose,
}: {
  initialModel: Plan['id']
  paymentsEnabled: boolean
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const quantityLabelId = useId()

  const [model, setModel] = useState<Plan['id']>(initialModel)
  const [quantity, setQuantity] = useState(1)
  const [errors, setErrors] = useState<CheckoutErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState<CheckoutMode | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  // Play in on mount, and delay the actual unmount briefly on close so the
  // exit transition (see .modal-backdrop/.modal-sheet in globals.css) can play.
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const isBusy = pending !== null

  const requestClose = useCallback(() => {
    // Never yank the dialog away mid-redirect.
    if (pending !== null) return
    setIsClosing(true)
    setIsVisible(false)
    window.setTimeout(onClose, 200)
  }, [onClose, pending])

  const isCustom = model === 'custom'
  const selectedPlan = getPlan(model) ?? plans[0]

  const total = useMemo(
    () => orderTotalEur(selectedPlan, quantity),
    [selectedPlan, quantity],
  )

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Move focus into the dialog on open.
  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  // Escape to close + focus trap.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        requestClose()
        return
      }
      if (e.key === 'Tab') {
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        if (!focusables || focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [requestClose])

  /**
   * Hands the browser off to the myPOS hosted page.
   *
   * myPOS accepts a purchase only as an HTML form POST, so we build one from the
   * server-signed fields and submit it as a top-level navigation. No window.open,
   * so popup blockers are not involved.
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

  async function submit(mode: CheckoutMode, form: HTMLFormElement) {
    if (isBusy) return

    const data = new FormData(form)
    const payload = {
      mode,
      planId: model,
      quantity,
      name: String(data.get('name') ?? ''),
      email: String(data.get('email') ?? ''),
      phone: String(data.get('phone') ?? ''),
      city: String(data.get('city') ?? ''),
      printName: isCustom ? String(data.get('printName') ?? '') : '',
      customization: isCustom ? String(data.get('customization') ?? '') : '',
      message: String(data.get('message') ?? ''),
      acceptTerms: data.get('acceptTerms') === 'on',
      marketingConsent: data.get('marketingConsent') === 'on',
    }

    // Same validator the API route runs, so inline errors match the server's.
    const { errors: found } = validateCheckout(payload)
    setErrors(found)
    setFormError(null)
    if (Object.keys(found).length > 0) {
      const firstInvalid = dialogRef.current?.querySelector<HTMLElement>(
        '[aria-invalid="true"]',
      )
      firstInvalid?.focus()
      return
    }

    setPending(mode)
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json().catch(() => null)

      if (!response.ok || !result?.ok) {
        if (result?.error === 'validation' && result.errors) {
          setErrors(result.errors as CheckoutErrors)
        } else if (result?.error === 'rate_limited') {
          setFormError('Твърде много заявки. Опитайте отново след няколко минути.')
        } else if (
          result?.error === 'payment_unavailable' ||
          result?.error === 'unavailable'
        ) {
          setFormError(
            'Плащането с карта е временно недостъпно. Изпратете заявка чрез „Свържете се с мен“ и ще довършим поръчката заедно.',
          )
        } else {
          setFormError('Нещо се обърка. Опитайте отново или ни изпратете заявка за контакт.')
        }
        setPending(null)
        return
      }

      if (result.mode === 'pay' && result.action && result.fields) {
        // Keep the pending state on screen — the navigation follows immediately.
        postToMypos(result.action as string, result.fields as Record<string, string>)
        return
      }

      setOutcome({ kind: 'contact', orderNumber: result.orderNumber })
      setPending(null)
    } catch {
      setFormError(
        'Няма връзка със сървъра. Проверете интернет връзката и опитайте отново.',
      )
      setPending(null)
    }
  }

  return (
    <div
      className={`modal-backdrop fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-charcoal/60 p-0 sm:items-center sm:p-5 ${
        isVisible && !isClosing ? 'is-open' : ''
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`modal-sheet relative flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-xl border border-border-soft bg-cream shadow-soft-lg sm:max-h-[90vh] sm:rounded-xl ${
          isVisible && !isClosing ? 'is-open' : ''
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border-soft px-6 py-4">
          <h2
            id="modal-title"
            className="font-display text-xl font-semibold text-charcoal"
          >
            {outcome ? 'Благодарим ви!' : 'Поръчай сега'}
          </h2>
          <button
            type="button"
            aria-label="Затвори"
            onClick={requestClose}
            disabled={isBusy}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border-soft bg-cream text-charcoal disabled:opacity-40"
          >
            <CloseIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {outcome ? (
          <div className="px-6 py-10 text-center">
            <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-border-soft bg-salmon">
              <CheckIcon className="h-7 w-7 text-charcoal" aria-hidden="true" />
            </span>
            <p className="mt-5 text-pretty text-base leading-relaxed text-charcoal">
              Получихме заявката ви. Ще се свържем с вас възможно най-скоро, за да
              потвърдим поръчката и доставката.
            </p>
            {outcome.orderNumber && (
              <p className="mt-3 text-sm text-charcoal-soft">
                Номер на заявката:{' '}
                <span className="font-semibold tabular-nums">
                  {outcome.orderNumber}
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
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submit(paymentsEnabled ? 'pay' : 'contact', e.currentTarget)
            }}
            noValidate
            className="flex min-h-0 flex-1 flex-col"
          >
            {/* Only the fields scroll — the total and the actions stay pinned so
                the primary CTA is never below the fold. */}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <fieldset disabled={isBusy} className="flex flex-col gap-4">
              <Field label="Модел" error={errors.planId}>
                <select
                  name="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value as Plan['id'])}
                  aria-invalid={errors.planId ? true : undefined}
                  className="modal-input"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.euro} ({p.lev})
                    </option>
                  ))}
                </select>
              </Field>

              <div>
                <span
                  id={quantityLabelId}
                  className="mb-1.5 block font-sans text-sm font-semibold text-charcoal"
                >
                  Количество
                </span>
                <QuantityStepper
                  value={quantity}
                  onChange={setQuantity}
                  disabled={isBusy}
                  labelId={quantityLabelId}
                />
                {errors.quantity && (
                  <span className="mt-1 block text-sm font-medium text-salmon-deep">
                    {errors.quantity}
                  </span>
                )}
              </div>

              <Field label="Име" error={errors.name}>
                <input
                  ref={firstFieldRef}
                  name="name"
                  type="text"
                  autoComplete="name"
                  aria-invalid={errors.name ? true : undefined}
                  className="modal-input"
                />
              </Field>

              <Field label="Имейл" error={errors.email}>
                <input
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  aria-invalid={errors.email ? true : undefined}
                  className="modal-input"
                />
              </Field>

              <Field label="Телефон" error={errors.phone}>
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  aria-invalid={errors.phone ? true : undefined}
                  className="modal-input"
                />
              </Field>

              <Field label="Град / офис на куриер" error={errors.city}>
                <input
                  name="city"
                  type="text"
                  aria-invalid={errors.city ? true : undefined}
                  className="modal-input"
                />
              </Field>

              {isCustom && (
                <>
                  <Field label="Име за печат">
                    <input name="printName" type="text" className="modal-input" />
                  </Field>
                  <Field label="Допълнителна персонализация">
                    <textarea
                      name="customization"
                      rows={2}
                      className="modal-input resize-none"
                    />
                  </Field>
                </>
              )}

              <Field label="Съобщение (по избор)">
                <textarea
                  name="message"
                  rows={2}
                  className="modal-input resize-none"
                />
              </Field>

              {paymentsEnabled && (
                <Checkbox name="acceptTerms" error={errors.acceptTerms}>
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
                </Checkbox>
              )}

              <Checkbox name="marketingConsent">
                Искам да получавам новини и промоции по имейл. (по избор)
              </Checkbox>
            </fieldset>
            </div>

            <div className="shrink-0 border-t border-border-soft bg-cream px-6 py-4 sm:py-5">
            {/* Running total — the server recomputes this authoritatively. */}
            <div className="flex items-baseline justify-between gap-4 rounded-md border border-border-soft bg-kraft/40 px-4 py-3">
              <span className="font-sans text-sm font-semibold text-charcoal">
                Общо
                {quantity > 1 && (
                  <span className="ml-1 font-normal text-charcoal-soft">
                    ({quantity} × {selectedPlan.euro})
                  </span>
                )}
              </span>
              <span className="text-right">
                <span className="font-display text-2xl font-bold text-charcoal">
                  {formatEur(total)}
                </span>
                <span className="ml-2 text-sm text-charcoal-soft">
                  ({formatBgn(eurToBgn(total))})
                </span>
              </span>
            </div>

            {formError && (
              <p
                role="alert"
                className="mt-4 rounded-md border border-salmon-deep bg-salmon/30 px-4 py-3 text-sm leading-relaxed text-charcoal"
              >
                {formError}
              </p>
            )}

            {paymentsEnabled ? (
              <>
                <button
                  type="submit"
                  disabled={isBusy}
                  className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-border-soft bg-salmon px-6 py-3 font-sans text-base font-semibold text-charcoal shadow-soft transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-salmon-hover hover:shadow-soft-lg active:scale-[0.96] active:duration-100 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:scale-100"
                >
                  {pending === 'pay' ? (
                    <>
                      <Spinner />
                      Пренасочваме ви…
                    </>
                  ) : (
                    <>Плати онлайн — {formatEur(total)}</>
                  )}
                </button>

                {/* Kept to one line on small screens — the pinned footer must
                    not crowd out the fields it sits below. */}
                <p className="mt-2.5 flex items-start justify-center gap-2 text-center text-sm leading-relaxed text-charcoal-soft">
                  <ShieldIcon
                    className="mt-0.5 h-4 w-4 shrink-0 text-salmon-deep"
                    aria-hidden="true"
                  />
                  <span>
                    Сигурно плащане чрез myPOS.
                    <span className="hidden sm:inline">
                      {' '}
                      Не съхраняваме данни от картата ви.
                    </span>
                  </span>
                </p>

                <div
                  className="my-3 flex items-center gap-3 sm:my-4"
                  aria-hidden="true"
                >
                  <span className="h-px flex-1 bg-border-soft" />
                  <span className="font-sans text-xs uppercase tracking-wider text-charcoal-soft">
                    или
                  </span>
                  <span className="h-px flex-1 bg-border-soft" />
                </div>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={(e) => {
                    const form = e.currentTarget.closest('form')
                    if (form) submit('contact', form)
                  }}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-border-soft bg-transparent px-6 py-3 font-sans text-base font-semibold text-charcoal transition-all duration-200 hover:bg-charcoal/5 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {pending === 'contact' ? (
                    <>
                      <Spinner />
                      Изпращаме…
                    </>
                  ) : (
                    'Свържете се с мен вместо това'
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  type="submit"
                  disabled={isBusy}
                  className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-border-soft bg-salmon px-6 py-3 font-sans text-base font-semibold text-charcoal shadow-soft transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-salmon-hover hover:shadow-soft-lg active:scale-[0.96] active:duration-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {pending ? (
                    <>
                      <Spinner />
                      Изпращаме…
                    </>
                  ) : (
                    'Поръчай сега'
                  )}
                </button>
                <p className="mt-3 text-center text-sm text-charcoal-soft">
                  Ще се свържем с вас, за да потвърдим детайлите.
                </p>
              </>
            )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-charcoal/30 border-t-charcoal"
    />
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-sans text-sm font-semibold text-charcoal">
        {label}
      </span>
      {children}
      {error && (
        <span className="mt-1 block text-sm font-medium text-salmon-deep">{error}</span>
      )}
    </label>
  )
}

function Checkbox({
  name,
  error,
  children,
}: {
  name: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name={name}
          aria-invalid={error ? true : undefined}
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
