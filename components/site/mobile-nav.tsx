'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { CloseIcon, MenuIcon } from './icons'

export type NavLink = { href: string; label: string }

/**
 * Below `md` the header nav is hidden, which previously left the section
 * anchors unreachable on phones entirely.
 *
 * This is a disclosure, not a modal dialog: the panel drops below the sticky
 * header rather than covering the viewport, so it needs no focus trap and no
 * body scroll lock — and we avoid duplicating the intricate trap logic in
 * modal-shell.tsx, which exists for a genuinely modal surface.
 */
export function MobileNav({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? 'Затвори менюто' : 'Отвори менюто'}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-charcoal/5"
      >
        {open ? (
          <CloseIcon className="h-6 w-6" aria-hidden="true" />
        ) : (
          <MenuIcon className="h-6 w-6" aria-hidden="true" />
        )}
      </button>

      {/* Same grid-rows 0fr→1fr collapse the FAQ accordion uses: no height
          math, and globals.css already neutralizes it under
          prefers-reduced-motion. */}
      <div
        id={panelId}
        // Opaque, and deliberately no backdrop-blur: the header above already
        // has one, and a nested backdrop-filter is confined to its ancestor's
        // backdrop root, which stops this panel compositing over the page at
        // all — page content shows straight through it.
        className={`faq-panel absolute inset-x-0 top-full border-border-soft bg-cream shadow-soft ${
          open ? 'is-open border-b' : ''
        }`}
      >
        <div>
          <nav aria-label="Мобилна навигация" className="px-5 py-2">
            <ul className="flex flex-col">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    tabIndex={open ? undefined : -1}
                    aria-hidden={open ? undefined : true}
                    className="link-underline inline-flex min-h-11 items-center text-base font-medium text-charcoal hover:text-salmon-deep"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  )
}
