'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { Plan } from '@/lib/data/pricing'
import { ContactModal } from './contact-modal'

type ModelId = Plan['id']

type ModalContextValue = {
  open: (model?: ModelId) => void
}

const ModalContext = createContext<ModalContextValue | null>(null)

export function useContactModal() {
  const ctx = useContext(ModalContext)
  if (!ctx) throw new Error('useContactModal must be used within ModalProvider')
  return ctx
}

export function ModalProvider({
  children,
  /**
   * Server-rendered starting value (see PageShell), so no public env var is
   * needed to tell the browser whether card payment is available.
   *
   * The landing page is statically prerendered, which means this value is fixed
   * at build time. Credentials added to the hosting environment afterwards would
   * otherwise stay invisible until the next deploy, so it is confirmed against
   * /api/checkout/config once the user shows intent to order.
   */
  paymentsEnabled: paymentsEnabledInitial = false,
}: {
  children: React.ReactNode
  paymentsEnabled?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [model, setModel] = useState<ModelId>('standard')
  const [paymentsEnabled, setPaymentsEnabled] = useState(paymentsEnabledInitial)
  // The element that triggered the modal, so focus can return to it on close.
  const triggerRef = useRef<HTMLElement | null>(null)
  const configRequested = useRef(false)

  // Confirm once per page load, on first intent to order rather than up front,
  // so a visitor who never opens the modal costs no request.
  const [shouldConfirm, setShouldConfirm] = useState(false)
  useEffect(() => {
    if (!shouldConfirm || configRequested.current) return
    configRequested.current = true

    const controller = new AbortController()
    fetch('/api/checkout/config', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (typeof data?.paymentsEnabled === 'boolean') {
          setPaymentsEnabled(data.paymentsEnabled)
        }
      })
      // On failure keep the server-rendered value; the checkout route still
      // refuses a card payment it cannot honour.
      .catch(() => {})

    return () => controller.abort()
  }, [shouldConfirm])

  const open = useCallback((selected: ModelId = 'standard') => {
    triggerRef.current = document.activeElement as HTMLElement | null
    setModel(selected)
    setIsOpen(true)
    setShouldConfirm(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    // Return focus to the trigger button.
    triggerRef.current?.focus?.()
  }, [])

  return (
    <ModalContext.Provider value={{ open }}>
      {children}
      {isOpen && (
        <ContactModal
          initialModel={model}
          paymentsEnabled={paymentsEnabled}
          onClose={close}
        />
      )}
    </ModalContext.Provider>
  )
}
