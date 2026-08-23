'use client'

import Image from 'next/image'
import { CtaButton } from './cta-button'
import { BagIcon } from './icons'

const sections = [
  { href: '#pricing', label: 'Цени' },
  { href: '#assembly', label: 'Сглобяване' },
  { href: '#faq', label: 'Въпроси' },
]

export function Header() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border-soft bg-cream/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between gap-3 px-5">
          <a
            href="#hero"
            className="flex min-w-0 items-center"
            aria-label="Wondercraft Начало"
          >
            <Image
              src="/wondercraft-logo.png"
              alt=""
              width={600}
              height={131}
              className="h-9 w-auto object-contain sm:h-11"
              priority
            />
          </a>

          <nav
            aria-label="Основна навигация"
            className="hidden items-center gap-7 md:flex"
          >
            {sections.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="link-underline text-sm font-medium text-charcoal hover:text-salmon-deep"
              >
                {label}
              </a>
            ))}
          </nav>

          {/* shrink-0 so the label never gets squeezed into an ellipsis on a
              320px screen, where the logo and the button together are within a
              few pixels of the available width. */}
          <CtaButton model="standard" className="shrink-0 px-4 py-2 text-base">
            <BagIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
            {/* Full label on wider screens, short label on very small screens */}
            <span className="hidden min-[400px]:inline">Поръчай сега</span>
            <span className="min-[400px]:hidden">Поръчай</span>
          </CtaButton>
        </div>
      </header>

      {/* Mobile section nav. Below md the nav above is hidden and the only way
          around the page was to scroll, or to reach the footer. This sits
          outside the sticky header on purpose: it is discoverable at the top of
          the page and then scrolls away, rather than costing every mobile
          screen a permanent second header row. */}
      <nav
        aria-label="Раздели"
        className="border-b border-border-soft bg-cream/60 md:hidden"
      >
        <ul className="mx-auto flex w-full max-w-[1120px] items-center gap-1 px-4">
          {sections.map(({ href, label }) => (
            <li key={href}>
              <a
                href={href}
                className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-charcoal-soft active:bg-charcoal/5"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
