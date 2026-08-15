'use client'

import Image from 'next/image'
import { CtaButton } from './cta-button'
import { BagIcon } from './icons'
import { MobileNav, type NavLink } from './mobile-nav'

// Single source for both the desktop row and the mobile disclosure panel, so
// the two can't drift apart.
const navLinks: NavLink[] = [
  { href: '#pricing', label: 'Цени' },
  { href: '#assembly', label: 'Сглобяване' },
  { href: '#faq', label: 'Въпроси' },
]

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border-soft bg-cream/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between px-5">
        <a
          href="#hero"
          className="flex items-center"
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
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="link-underline text-sm font-medium text-charcoal hover:text-salmon-deep"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <MobileNav links={navLinks} />

          <CtaButton
            model="standard"
            className="min-h-11 px-4 py-2 text-base"
          >
            <BagIcon className="h-5 w-5" aria-hidden="true" />
            {/* Full label on wider screens, short label on very small screens */}
            <span className="hidden min-[400px]:inline">Поръчай сега</span>
            <span className="min-[400px]:hidden">Поръчай</span>
          </CtaButton>
        </div>
      </div>
    </header>
  )
}
