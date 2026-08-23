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
 * `aside` renders outside the scrolling body, so the order total stays put while
 * the body scrolls. Where it sits depends on the width:
 *
 * - below `lg` the sheet is a flex column and the aside is the footer strip —
 *   bounded height in dvh rather than vh, so an on-screen keyboard does not push
 *   the submit button off the bottom;
 * - from `lg` the sheet becomes a two-column grid and the aside is the right
 *   column, beside the form rather than under it.
 *
 * It is the same node in both cases, moved by CSS. Rendering it twice and hiding
 * one copy would duplicate the summary's aria-live region, and screen readers
 * would announce every shipping quote twice.
 */
export function ModalShell({
  title,
  onClose,
  children,
  aside,
  dismissible = true,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  aside?: React.ReactNode
  /**
   * False while an action must not be interrupted — a card payment in flight.
   *
   * During a 3DS challenge the customer is looking at Stripe's overlay, not at
   * this dialog, and a stray Escape or a click on what looks like empty space
   * would tear down the React tree mid-payment. Blocks Escape, the backdrop and
   * the close button together; anything less just moves the hole.
   */
  dismissible?: boolean
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
        // Mid-payment: swallow it rather than closing. Still preventDefault, so
        // nothing further up treats it as an unhandled Escape.
        e.preventDefault()
        if (!dismissible) return
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
  }, [requestClose, dismissible])

  const isOpen = isVisible && !isClosing

  return (
    <div
      className={`modal-backdrop fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-charcoal/60 p-0 sm:items-center sm:p-5 ${
        isOpen ? 'is-open' : ''
      }`}
      onMouseDown={(e) => {
        if (!dismissible) return
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`modal-sheet relative flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-xl border border-border-soft bg-cream shadow-soft-lg sm:max-h-[92dvh] sm:rounded-xl ${
          // Two columns only when there is something to put beside the body.
          // minmax(0,…) rather than a bare 1fr: the default min-width:auto lets
          // the office list and long city names widen the column instead of
          // scrolling inside it.
          aside
            ? 'max-w-lg lg:grid lg:max-w-4xl lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_minmax(0,1fr)]'
            : 'max-w-lg'
        } ${isOpen ? 'is-open' : ''}`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border-soft px-6 py-4 lg:col-span-2">
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
            disabled={!dismissible}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border-soft bg-cream text-charcoal disabled:cursor-not-allowed disabled:opacity-45"
          >
            <CloseIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <ModalShellContext.Provider value={{ dialogRef, requestClose }}>
          {children}
          {aside && (
            // Footer strip below lg, right-hand column from lg up. The tint
            // reads the column as a separate receipt surface once it sits
            // beside the form; as a footer strip it stays flush with the sheet.
            <div className="shrink-0 border-t border-border-soft bg-cream px-6 py-4 lg:col-start-2 lg:row-start-2 lg:overflow-y-auto lg:border-l lg:border-t-0 lg:bg-kraft/20 lg:py-6">
              {aside}
            </div>
          )}
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
