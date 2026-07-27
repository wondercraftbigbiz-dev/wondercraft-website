'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, MapPin, X } from 'lucide-react'
import { plans, type Plan } from '@/lib/data/pricing'
import type { EcontSelection } from './econt-picker'
import { DeliveryModal } from './delivery-modal'
import { formatLev, planLev, totalLev } from '@/lib/econt/format'

type Errors = Partial<Record<'name' | 'phone' | 'office' | 'model', string>>

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
  const [delivery, setDelivery] = useState<EcontSelection | null>(null)
  const [shippingPrice, setShippingPrice] = useState<number | null>(null)
  const [deliveryOpen, setDeliveryOpen] = useState(false)

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

  // Escape to close + focus trap. Suspended while the delivery dialog is open,
  // so it owns the keyboard on its own.
  useEffect(() => {
    if (deliveryOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
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
  }, [onClose, deliveryOpen])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const next: Errors = {}

    if (!String(data.get('name') ?? '').trim()) next.name = 'Моля, въведете име.'
    if (!String(data.get('phone') ?? '').trim())
      next.phone = 'Моля, въведете телефон.'
    if (!delivery) next.office = 'Моля, изберете офис на Еконт.'
    if (!String(data.get('model') ?? '').trim())
      next.model = 'Моля, изберете модел.'

    setErrors(next)
    if (Object.keys(next).length === 0) {
      // Prototype: nothing is sent anywhere and no shipment is created. The log
      // is here so the captured Econt office can be checked in DevTools.
      console.log('[prototype order]', {
        name: data.get('name'),
        phone: data.get('phone'),
        model,
        printName: data.get('printName'),
        customization: data.get('customization'),
        message: data.get('message'),
        delivery: delivery && {
          cityId: delivery.city.id,
          cityName: delivery.city.name,
          officeId: delivery.office.id,
          officeCode: delivery.office.code,
          officeName: delivery.office.name,
        },
        shippingPrice,
      })
      setSubmitted(true)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-charcoal/60 p-0 sm:items-center sm:p-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        style={{ animation: 'modal-rise 180ms ease-out' }}
        className="relative w-full max-w-lg rounded-t-[8px] border-2 border-charcoal bg-cream sm:rounded-[8px]"
      >
        <div className="flex items-center justify-between border-b-2 border-charcoal px-6 py-4">
          <h2
            id="modal-title"
            className="font-display text-xl font-semibold text-charcoal"
          >
            {submitted ? 'Благодарим ви!' : 'Поръчай сега'}
          </h2>
          <button
            type="button"
            aria-label="Затвори"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border-2 border-charcoal bg-cream text-charcoal"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {submitted ? (
          <div className="px-6 py-10 text-center">
            <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-[8px] border-2 border-charcoal bg-salmon">
              <Check className="h-7 w-7 text-charcoal" aria-hidden="true" />
            </span>
            <p className="mt-5 text-pretty text-base leading-relaxed text-charcoal">
              Получихме заявката ви. Ще се свържем с вас възможно най-скоро, за да
              потвърдим поръчката и доставката.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[8px] border-2 border-charcoal bg-transparent px-6 py-3 font-display text-base font-semibold text-charcoal"
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

              <div>
                <span className="mb-1.5 block font-display text-sm font-semibold text-charcoal">
                  Доставка
                </span>
                <button
                  type="button"
                  onClick={() => setDeliveryOpen(true)}
                  aria-haspopup="dialog"
                  className="flex w-full items-center gap-3 rounded-[8px] border-2 border-charcoal bg-cream px-3 py-2.5 text-left transition-colors hover:bg-kraft/50"
                >
                  <MapPin
                    className="h-5 w-5 shrink-0 text-charcoal-soft"
                    aria-hidden="true"
                  />
                  {delivery ? (
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-sm font-semibold text-charcoal">
                        {delivery.office.name}
                      </span>
                      <span className="block truncate text-sm text-charcoal-soft">
                        {delivery.city.name}
                        {delivery.office.address ? `, ${delivery.office.address}` : ''}
                      </span>
                    </span>
                  ) : (
                    <span className="flex-1 text-base text-charcoal-soft">
                      Изберете офис на Еконт
                    </span>
                  )}
                  <span className="shrink-0 font-display text-sm font-semibold text-charcoal">
                    {delivery ? 'Промени' : 'Избери'}
                  </span>
                </button>
                {errors.office && (
                  <span className="mt-1 block text-sm font-medium text-salmon">
                    {errors.office}
                  </span>
                )}
              </div>
            </div>

            {delivery && (
              <dl className="mt-5 flex flex-col gap-1.5 rounded-[8px] border-2 border-charcoal bg-kraft/40 px-4 py-3 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-charcoal-soft">
                    {plans.find((p) => p.id === model)?.name}
                  </dt>
                  <dd className="font-semibold text-charcoal">{planLev(model)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-charcoal-soft">Доставка до офис</dt>
                  <dd className="font-semibold text-charcoal">
                    {shippingPrice != null
                      ? formatLev(shippingPrice)
                      : 'по тарифа на Еконт'}
                  </dd>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-3 border-t-2 border-charcoal/20 pt-2">
                  <dt className="font-display font-semibold text-charcoal">Общо</dt>
                  <dd className="font-display font-semibold text-charcoal">
                    {shippingPrice != null
                      ? totalLev(model, shippingPrice)
                      : planLev(model) + ' + доставка'}
                  </dd>
                </div>
              </dl>
            )}

            <button
              type="submit"
              className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-[8px] border-2 border-charcoal bg-salmon px-6 py-3 font-display text-base font-semibold text-charcoal transition-all duration-150 hover:bg-salmon-hover hover:scale-[1.02]"
            >
              Поръчай сега
            </button>
            <p className="mt-3 text-center text-sm text-charcoal-soft">
              Плащането е онлайн. Ще се свържем с вас, за да потвърдим детайлите.
            </p>
          </form>
        )}
      </div>

      <style>{`
        @keyframes modal-rise {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .modal-input {
          width: 100%;
          border: 2px solid var(--color-charcoal);
          border-radius: 8px;
          background: var(--color-cream);
          color: var(--color-charcoal);
          padding: 0.625rem 0.75rem;
          font-size: 16px;
          font-family: var(--font-sans);
        }
        .modal-input::placeholder { color: var(--color-charcoal-soft); }
      `}</style>

      {deliveryOpen && (
        <DeliveryModal
          initial={delivery}
          onClose={() => setDeliveryOpen(false)}
          onConfirm={(selection, price) => {
            setDelivery(selection)
            setShippingPrice(price)
            setErrors((prev) => ({ ...prev, office: undefined }))
            setDeliveryOpen(false)
          }}
        />
      )}
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
      <span className="mb-1.5 block font-display text-sm font-semibold text-charcoal">
        {label}
      </span>
      {children}
      {error && (
        <span className="mt-1 block text-sm font-medium text-salmon">{error}</span>
      )}
    </label>
  )
}
