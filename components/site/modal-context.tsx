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

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [model, setModel] = useState<ModelId>('standard')
  // The element that triggered the modal, so focus can return to it on close.
  const triggerRef = useRef<HTMLElement | null>(null)

  const open = useCallback((selected: ModelId = 'standard') => {
    triggerRef.current = document.activeElement as HTMLElement | null
    setModel(selected)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    // Return focus to the trigger button.
    triggerRef.current?.focus?.()
  }, [])

  return (
    <ModalContext.Provider value={{ open }}>
      {children}
      {isOpen && <ContactModal initialModel={model} onClose={close} />}
    </ModalContext.Provider>
  )
}
