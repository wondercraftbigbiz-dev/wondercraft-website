'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { plans, type Plan } from '@/lib/data/pricing'
import { CheckIcon, CloseIcon } from './icons'

type Errors = Partial<
  Record<'name' | 'phone' | 'email' | 'city' | 'model', string>
>

// Permissive on purpose — catches typos, not exotic-but-valid addresses.
// The server applies the same check before writing anything.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function ContactModal({
  initialModel,
  onClose,
}: {
  initialModel: Plan['id']
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)

  const [model, setModel] = useState<Plan['id']>(initialModel)
  const [errors, setErrors] = useState<Errors>({})
  const [submitted, setSubmitted] = useState(false)
  const [orderNumber, setOrderNumber] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [marketingConsent, setMarketingConsent] = useState(false)

  // Held in state rather than read from the DOM: these two inputs unmount when
  // the customer switches away from the custom model, which would otherwise
  // silently drop whatever they had typed.
  const [printName, setPrintName] = useState('')
  const [customization, setCustomization] = useState('')

  // Play in on mount, and delay the actual unmount briefly on close so the
  // exit transition (see .modal-backdrop/.modal-sheet in globals.css) can play.
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const requestClose = useCallback(() => {
    setIsClosing(true)
    setIsVisible(false)
    window.setTimeout(onClose, 200)
  }, [onClose])

  const isCustom = model === 'custom'

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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (isSubmitting) return

    const data = new FormData(e.currentTarget)
    const next: Errors = {}

    const name = String(data.get('name') ?? '').trim()
    const phone = String(data.get('phone') ?? '').trim()
    const email = String(data.get('email') ?? '').trim()
    const city = String(data.get('city') ?? '').trim()

    if (!name) next.name = 'Моля, въведете име.'
    if (!phone) next.phone = 'Моля, въведете телефон.'
    if (!email) next.email = 'Моля, въведете имейл.'
    else if (!EMAIL_RE.test(email)) next.email = 'Моля, проверете имейла.'
    if (!city) next.city = 'Моля, въведете град или офис на куриер.'
    if (!String(data.get('model') ?? '').trim())
      next.model = 'Моля, изберете модел.'

    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          email,
          city,
          model,
          printName: isCustom ? printName : '',
          customization: isCustom ? customization : '',
          message: String(data.get('message') ?? '').trim(),
          marketingConsent,
          website: String(data.get('website') ?? ''),
        }),
      })

      const payload = (await res.json().catch(() => null)) as
        | { ok: boolean; orderNumber?: number | null; error?: string }
        | null

      if (!res.ok || !payload?.ok) {
        setSubmitError(
          payload?.error ??
            'Възникна проблем при изпращането. Моля, опитайте отново.',
        )
        return
      }

      setOrderNumber(payload.orderNumber ?? null)
      setSubmitted(true)
    } catch {
      setSubmitError(
        'Няма връзка със сървъра. Моля, проверете интернет връзката си и опитайте отново.',
      )
    } finally {
      setIsSubmitting(false)
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
        className={`modal-sheet relative w-full max-w-lg rounded-t-xl border border-border-soft bg-cream shadow-soft-lg sm:rounded-xl ${
          isVisible && !isClosing ? 'is-open' : ''
        }`}
      >
        <div className="flex items-center justify-between border-b border-border-soft px-6 py-4">
          <h2
            id="modal-title"
            className="font-display text-xl font-semibold text-charcoal"
          >
            {submitted ? 'Благодарим ви!' : 'Поръчай сега'}
          </h2>
          <button
            type="button"
            aria-label="Затвори"
            onClick={requestClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border-soft bg-cream text-charcoal"
          >
            <CloseIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {submitted ? (
          <div className="px-6 py-10 text-center">
            <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-border-soft bg-salmon">
              <CheckIcon className="h-7 w-7 text-charcoal" aria-hidden="true" />
            </span>
            <p className="mt-5 text-pretty text-base leading-relaxed text-charcoal">
              Получихме заявката ви. Ще се свържем с вас възможно най-скоро, за да
              потвърдим поръчката и доставката.
            </p>
            {orderNumber !== null && (
              <p className="mt-3 font-sans text-sm font-semibold text-charcoal-soft">
                Номер на поръчка: #{orderNumber}
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
            onSubmit={handleSubmit}
            noValidate
            className="max-h-[70vh] overflow-y-auto px-6 py-5"
          >
            <div className="flex flex-col gap-4">
              <Field label="Име" error={errors.name}>
                <input
                  ref={firstFieldRef}
                  name="name"
                  type="text"
                  autoComplete="name"
                  className="modal-input"
                />
              </Field>

              <Field label="Телефон" error={errors.phone}>
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  className="modal-input"
                />
              </Field>

              <Field label="Имейл" error={errors.email}>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  className="modal-input"
                />
              </Field>

              <Field label="Град / офис на куриер" error={errors.city}>
                <input name="city" type="text" className="modal-input" />
              </Field>

              <Field label="Модел" error={errors.model}>
                <select
                  name="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value as Plan['id'])}
                  className="modal-input"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.euro} ({p.lev})
                    </option>
                  ))}
                </select>
              </Field>

              {isCustom && (
                <>
                  <Field label="Име за печат">
                    <input
                      name="printName"
                      type="text"
                      value={printName}
                      onChange={(e) => setPrintName(e.target.value)}
                      className="modal-input"
                    />
                  </Field>
                  <Field label="Допълнителна персонализация">
                    <textarea
                      name="customization"
                      rows={2}
                      value={customization}
                      onChange={(e) => setCustomization(e.target.value)}
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

              <ConsentCheckbox
                checked={marketingConsent}
                onChange={setMarketingConsent}
              />

              {/* Honeypot. Hidden from people, tempting to bots. */}
              <div aria-hidden="true" className="honeypot">
                <label>
                  Уебсайт
                  <input
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </label>
              </div>
            </div>

            {submitError && (
              <p
                role="alert"
                className="mt-5 rounded-md border border-salmon-deep bg-salmon/30 px-4 py-3 text-sm font-medium text-charcoal"
              >
                {submitError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border-soft bg-salmon px-6 py-3 font-sans text-base font-semibold text-charcoal shadow-soft transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-salmon-hover hover:shadow-soft-lg active:scale-[0.96] active:duration-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:scale-100 disabled:hover:bg-salmon disabled:hover:shadow-soft"
            >
              {isSubmitting ? 'Изпращане…' : 'Поръчай сега'}
            </button>
            <p className="mt-3 text-center text-sm text-charcoal-soft">
              Ще се свържем с вас, за да потвърдим детайлите.
            </p>
          </form>
        )}
      </div>

      <style>{`
        .modal-input {
          width: 100%;
          border: 1px solid var(--color-border-soft);
          border-radius: var(--radius-md);
          background: var(--color-cream);
          color: var(--color-charcoal);
          padding: 0.625rem 0.75rem;
          font-size: 16px;
          font-family: var(--font-sans);
          transition: border-color 150ms ease-out;
        }
        .modal-input:focus-visible {
          border-color: var(--color-salmon-deep);
        }
        .modal-input::placeholder { color: var(--color-charcoal-soft); }

        /* Off-screen rather than display:none, so bots that skip hidden
           inputs still fill it in. */
        .honeypot {
          position: absolute;
          left: -9999px;
          width: 1px;
          height: 1px;
          overflow: hidden;
        }
      `}</style>
    </div>
  )
}

// Marketing opt-in. Unticked by default — consent has to be given, not withdrawn.
// Built from scratch because the codebase has no checkbox primitive; styling
// mirrors .modal-input so it sits naturally among the other fields.
function ConsentCheckbox({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1">
      <input
        type="checkbox"
        name="marketingConsent"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-border-soft bg-cream transition-colors duration-150 peer-checked:border-salmon-deep peer-checked:bg-salmon peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-[3px] peer-focus-visible:outline-salmon-deep"
      >
        {/* Driven by the prop, not peer-checked: the icon is nested inside this
            span rather than being a sibling of the input, so a peer variant
            would never match it. */}
        <CheckIcon
          className={`h-3.5 w-3.5 text-charcoal transition-opacity duration-150 ${
            checked ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </span>
      <span className="block">
        <span className="block font-sans text-sm font-semibold text-charcoal">
          Искам да получавам оферти и новини от Wondercraft
        </span>
        <span className="mt-0.5 block font-sans text-sm text-charcoal-soft">
          Можете да се отпишете по всяко време.
        </span>
      </span>
    </label>
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
