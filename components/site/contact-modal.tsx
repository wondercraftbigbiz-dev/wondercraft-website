'use client'

import { useEffect, useRef, useState } from 'react'
import { plans, type Plan } from '@/lib/data/pricing'
import { CheckIcon } from './icons'
import { Field } from './field'
import { ModalShell, useModalShell } from './modal-shell'

type Errors = Partial<Record<'name' | 'phone' | 'city' | 'model', string>>

export function ContactModal({
  initialModel,
  onClose,
}: {
  initialModel: Plan['id']
  onClose: () => void
}) {
  const firstFieldRef = useRef<HTMLInputElement>(null)

  const [model, setModel] = useState<Plan['id']>(initialModel)
  const [errors, setErrors] = useState<Errors>({})
  const [submitted, setSubmitted] = useState(false)

  const isCustom = model === 'custom'

  // Move focus into the dialog on open.
  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

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
    <ModalShell
      title={submitted ? 'Благодарим ви!' : 'Поръчай сега'}
      onClose={onClose}
    >
      {submitted ? (
        <SuccessPanel />
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
