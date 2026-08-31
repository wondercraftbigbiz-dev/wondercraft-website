'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
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

type ModalState = { kind: 'closed' } | { kind: 'contact'; model: ModelId }

/**
 * Owns the contact/order modal.
 *
 * Ordering is deliberately anonymous: "Поръчай сега" opens the form directly.
 * The orders table keys customers by email, not by an auth user, so there is
 * nothing an account would buy the visitor at this point in the funnel.
 */
export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modalState, setModalState] = useState<ModalState>({ kind: 'closed' })
  const triggerRef = useRef<HTMLElement | null>(null)

  const open = useCallback((selected: ModelId = 'standard') => {
    triggerRef.current = document.activeElement as HTMLElement | null
    setModalState({ kind: 'contact', model: selected })
  }, [])

  const close = useCallback(() => {
    setModalState({ kind: 'closed' })
    triggerRef.current?.focus?.()
  }, [])

  return (
    <ModalContext.Provider value={{ open }}>
      {children}
      {modalState.kind === 'contact' && (
        <ContactModal initialModel={modalState.model} onClose={close} />
      )}
    </ModalContext.Provider>
  )
}
