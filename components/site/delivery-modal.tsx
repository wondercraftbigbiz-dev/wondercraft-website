'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { EcontPicker, type EcontSelection } from './econt-picker'
import { useShippingQuote } from './use-shipping-quote'
import { formatLev } from '@/lib/econt/format'

/**
 * Office selection, lifted out of the order form into its own dialog.
 *
 * This sits on top of the order modal, so it has to defend against the parent's
 * key handling: the order modal listens for Escape on `document`, and without
 * the capture-phase interception below, one Escape would close both dialogs and
 * discard the whole form.
 */
export function DeliveryModal({
  initial,
  onConfirm,
  onClose,
}: {
  initial: EcontSelection | null
  onConfirm: (selection: EcontSelection, shippingPrice: number | null) => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [selection, setSelection] = useState<EcontSelection | null>(initial)
  const shipping = useShippingQuote(selection?.office.code ?? null)

  // Escape closes this dialog only. Capture phase, so it runs before the order
  // modal's document-level listener and can stop it.
  useEffect(() => {
    function onKeyDownCapture(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      // The city dropdown handles its own Escape and stops propagation before
      // this fires, so reaching here means no dropdown is open.
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', onKeyDownCapture, true)
    return () => document.removeEventListener('keydown', onKeyDownCapture, true)
  }, [onClose])

  // Keep Tab inside this dialog while it is open.
  useEffect(() => {
    function onKeyDownCapture(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (!focusables || focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      // Stop the parent trap from also acting on this Tab.
      e.stopPropagation()
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDownCapture, true)
    return () => document.removeEventListener('keydown', onKeyDownCapture, true)
  }, [])

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center overflow-y-auto bg-charcoal/60 p-0 sm:items-center sm:p-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delivery-modal-title"
        tabIndex={-1}
        style={{ animation: 'modal-rise 180ms ease-out' }}
        className="relative w-full max-w-lg rounded-t-[8px] border-2 border-charcoal bg-cream outline-none sm:rounded-[8px]"
      >
        <div className="flex items-center justify-between border-b-2 border-charcoal px-6 py-4">
          <h2
            id="delivery-modal-title"
            className="font-display text-xl font-semibold text-charcoal"
          >
            Доставка с Еконт
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

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          <EcontPicker value={selection} onChange={setSelection} />

          {selection && (
            <p className="mt-4 rounded-[8px] border-2 border-charcoal bg-kraft/40 px-4 py-3 text-sm">
              <span className="text-charcoal-soft">Цена на доставката: </span>
              <span className="font-display font-semibold text-charcoal">
                {shipping.loading
                  ? 'Изчисляване…'
                  : shipping.quote?.total != null
                    ? formatLev(shipping.quote.total)
                    : 'по тарифа на Еконт'}
              </span>
            </p>
          )}
        </div>

        <div className="flex gap-3 border-t-2 border-charcoal px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[8px] border-2 border-charcoal bg-transparent px-4 py-3 font-display text-base font-semibold text-charcoal"
          >
            Отказ
          </button>
          <button
            type="button"
            disabled={!selection}
            onClick={() =>
              selection && onConfirm(selection, shipping.quote?.total ?? null)
            }
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[8px] border-2 border-charcoal bg-salmon px-4 py-3 font-display text-base font-semibold text-charcoal transition-colors hover:bg-salmon-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Потвърди
          </button>
        </div>
      </div>
    </div>
  )
}
