'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { plans, type Plan } from '@/lib/data/pricing'
import { CheckIcon, CloseIcon } from './icons'

type Errors = Partial<Record<'name' | 'phone' | 'city' | 'model', string>>

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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const next: Errors = {}

    if (!String(data.get('name') ?? '').trim()) next.name = 'Моля, въведете име.'
    if (!String(data.get('phone') ?? '').trim())
      next.phone = 'Моля, въведете телефон.'
    if (!String(data.get('city') ?? '').trim())
      next.city = 'Моля, въведете град или офис на куриер.'
    if (!String(data.get('model') ?? '').trim())
      next.model = 'Моля, изберете модел.'

    setErrors(next)
    if (Object.keys(next).length === 0) {
      // Prototype: nothing is sent. Show fake success state.
      setSubmitted(true)
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
            </div>

            <button
              type="submit"
              className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border-soft bg-salmon px-6 py-3 font-sans text-base font-semibold text-charcoal shadow-soft transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-salmon-hover hover:shadow-soft-lg active:scale-[0.96] active:duration-100"
            >
              Поръчай сега
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
      `}</style>
    </div>
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
