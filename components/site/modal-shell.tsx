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
  /**
   * Portal target for popups that position themselves in viewport coordinates.
   *
   * The sheet cannot host those: `.modal-sheet` carries a transform for its
   * entrance animation, and a transformed element becomes the containing block
   * for `position: fixed` descendants — so viewport coordinates land in the
   * wrong place — and then clips them against its own `overflow-hidden`. This
   * layer sits inside the backdrop, beside the sheet, where neither applies.
   *
   * Only for popups that add no tabbable elements of their own (the combobox
   * listbox keeps focus on its input and tracks the active row with
   * aria-activedescendant); anything focusable still belongs inside dialogRef,
   * or the Tab trap will not see it.
   */
  popupRef: React.RefObject<HTMLDivElement | null>
}

const ModalShellContext = createContext<ModalShellContextValue | null>(null)

export function useModalShell(): ModalShellContextValue {
  const ctx = useContext(ModalShellContext)
  if (!ctx) throw new Error('useModalShell must be used within ModalShell')
  return ctx
}

/**
 * The same context, without the throw, for components that are reusable outside
 * a dialog and only want the portal target when there happens to be one.
 */
export function useOptionalModalShell(): ModalShellContextValue | null {
  return useContext(ModalShellContext)
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
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  aside?: React.ReactNode
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

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
  //
  // `overflow: hidden` on its own is not a scroll lock on iOS Safari — the
  // document still rubber-bands behind the sheet, and the page often comes back
  // at a different scroll position. Pinning the body with position: fixed at a
  // negative offset is what actually holds it, and the offset is what we restore
  // from on close. scroll-behavior has to be neutralised for that restore or the
  // smooth-scroll rule in globals.css animates it.
  useEffect(() => {
    const body = document.body
    const scrollY = window.scrollY
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    }

    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    body.style.overflow = 'hidden'

    return () => {
      Object.assign(body.style, prev)
      const html = document.documentElement
      const prevBehavior = html.style.scrollBehavior
      html.style.scrollBehavior = 'auto'
      window.scrollTo(0, scrollY)
      html.style.scrollBehavior = prevBehavior
    }
  }, [])

  // Track the visual viewport so the sheet sits on top of the software keyboard
  // rather than under it.
  //
  // The sheet is bounded in dvh, which is right for Android (Chrome resizes the
  // layout viewport when the keyboard opens) and does nothing at all on iOS,
  // which leaves the layout viewport at full height and only shrinks
  // window.visualViewport. Without this the aside — the order total and the
  // submit button — is behind the keyboard for the whole of a mobile checkout.
  const [viewport, setViewport] = useState<{
    top: number
    height: number
  } | null>(null)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const sync = () => setViewport({ top: vv.offsetTop, height: vv.height })
    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
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
      className={`modal-backdrop fixed inset-x-0 top-0 z-50 flex h-[100dvh] items-end justify-center overflow-y-auto overscroll-contain bg-charcoal/60 p-0 sm:items-center sm:p-5 ${
        isOpen ? 'is-open' : ''
      }`}
      style={
        viewport ? { top: viewport.top, height: viewport.height } : undefined
      }
      // pointerType, not a bare click: on touch this handler also receives the
      // synthesized mouse event at the end of a swipe, so a thumb that started
      // its drag on the sliver of visible backdrop used to close the sheet and
      // throw away a part-filled order.
      onPointerDown={(e) => {
        if (e.pointerType !== 'mouse') return
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <ModalShellContext.Provider value={{ dialogRef, popupRef, requestClose }}>
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className={`modal-sheet relative flex max-h-full w-full flex-col overflow-hidden rounded-t-xl border border-border-soft bg-cream shadow-soft-lg sm:max-h-[92dvh] sm:rounded-xl ${
            // Two columns only when there is something to put beside the body.
            // minmax(0,…) rather than a bare 1fr: the default min-width:auto lets
            // the office list and long city names widen the column instead of
            // scrolling inside it.
            aside
              ? 'max-w-lg lg:grid lg:max-w-4xl lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_minmax(0,1fr)]'
              : 'max-w-lg'
          } ${isOpen ? 'is-open' : ''}`}
        >
          {/* Grab bar. Purely a signal: below sm the sheet can fill the screen,
            and without it there is nothing to read the top edge as draggable
            chrome rather than a clipped dialog. */}
          <div
            className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border-soft-strong sm:hidden"
            aria-hidden="true"
          />

          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-soft px-5 py-3 sm:px-6 sm:py-4 lg:col-span-2">
            <h2
              id="modal-title"
              className="min-w-0 font-display text-xl font-semibold text-charcoal"
            >
              {title}
            </h2>
            {/* 44px: on a phone this is the primary way out — Escape needs a
              hardware keyboard and the backdrop is mouse-only above. -mr-1.5
              keeps the icon optically aligned with the padding. */}
            <button
              type="button"
              aria-label="Затвори"
              onClick={requestClose}
              className="-mr-1.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border-soft bg-cream text-charcoal active:bg-charcoal/5"
            >
              <CloseIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {children}
          {aside && (
            // Footer strip below lg, right-hand column from lg up. The tint
            // reads the column as a separate receipt surface once it sits
            // beside the form; as a footer strip it stays flush with the sheet.
            <div className="shrink-0 border-t border-border-soft bg-cream px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 lg:col-start-2 lg:row-start-2 lg:overflow-y-auto lg:border-l lg:border-t-0 lg:bg-kraft/20 lg:pb-6 lg:pt-6">
              {aside}
            </div>
          )}
        </div>

        {/* Popup layer — see popupRef above. Outside the sheet's transform and
            overflow, still inside the backdrop. */}
        <div ref={popupRef} />
      </ModalShellContext.Provider>
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
