'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { CloseIcon } from './icons'

type ModalShellContextValue = {
  /**
   * Close the dialog, playing the exit transition first. Children must use this
   * rather than the raw onClose prop, or the sheet vanishes without animating.
   */
  requestClose: () => void
  /**
   * The dialog element. Anything that needs to render a popup must portal into
   * this node rather than document.body — the Tab trap below only sees
   * descendants of the dialog, so a body-level popup would be unreachable by
   * keyboard.
   */
  dialogRef: React.RefObject<HTMLDivElement | null>
}

const ModalShellContext = createContext<ModalShellContextValue | null>(null)

export function useModalShell(): ModalShellContextValue {
  const ctx = useContext(ModalShellContext)
  if (!ctx) throw new Error('useModalShell must be used within ModalShell')
  return ctx
}

/**
 * The dialog chrome: backdrop, transitions, Escape, focus trap, scroll lock,
 * and the titled header with its close button.
 *
 * `footer` renders outside the scrolling body, so a sticky order total stays
 * visible while the body scrolls.
 */
export function ModalShell({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const dialogRef = useRef<HTMLDivElement>(null)

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

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Escape to close + focus trap.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // An inner layer (an open combobox list, a non-empty search box) marks
        // Escape as handled by calling preventDefault. Closing the whole modal
        // on top of that would discard the customer's form.
        //
        // This has to be checked here rather than stopped at the source: Next's
        // App Router hydrates the document, so React's delegated listener and
        // this one sit on the same node, where stopPropagation has no effect.
        // Tracking "is a layer open?" in a counter does not work either —
        // keydown is a discrete event, so React flushes the inner layer's state
        // update and its effect cleanup synchronously, before this listener
        // runs.
        if (e.defaultPrevented) return
        e.preventDefault()
        requestClose()
        return
      }
      if (e.key === 'Tab') {
        const focusables = getFocusables(dialogRef.current)
        if (focusables.length === 0) return
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

  const isOpen = isVisible && !isClosing

  return (
    <div
      className={`modal-backdrop fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-charcoal/60 p-0 sm:items-center sm:p-5 ${
        isOpen ? 'is-open' : ''
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
          isOpen ? 'is-open' : ''
        }`}
      >
        <div className="flex items-center justify-between border-b border-border-soft px-6 py-4">
          <h2
            id="modal-title"
            className="font-display text-xl font-semibold text-charcoal"
          >
            {title}
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

        <ModalShellContext.Provider value={{ dialogRef, requestClose }}>
          {children}
          {footer}
        </ModalShellContext.Provider>
      </div>
    </div>
  )
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
]
  .map((s) => `${s}:not([aria-hidden="true"])`)
  .join(', ')

/**
 * Tabbable descendants, in DOM order, excluding anything not actually rendered.
 *
 * The offsetParent check matters: a collapsed dropdown or a `hidden` panel still
 * matches the selector, and including it would make Tab appear to skip past the
 * end of the dialog. `position: fixed` elements have a null offsetParent too, so
 * the currently focused element is always kept.
 */
function getFocusables(root: HTMLElement | null): HTMLElement[] {
  if (!root) return []
  return Array.from(
    root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => el.offsetParent !== null || el === document.activeElement)
}
