'use client'

import Image from 'next/image'
import { ShoppingBag } from 'lucide-react'
import { CtaButton } from './cta-button'

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
            src="/wondercraft_logo_svg.svg"
            alt="Wondercraft Logo"
            width={220}
            height={52}
            className="h-11 w-auto object-contain"
            priority
          />
        </a>

        <nav
          aria-label="Основна навигация"
          className="hidden items-center gap-7 md:flex"
        >
          <a
            href="#pricing"
            className="link-underline text-sm font-medium text-charcoal hover:text-salmon-deep"
          >
            Цени
          </a>
          <a
            href="#assembly"
            className="link-underline text-sm font-medium text-charcoal hover:text-salmon-deep"
          >
            Сглобяване
          </a>
          <a
            href="#faq"
            className="link-underline text-sm font-medium text-charcoal hover:text-salmon-deep"
          >
            Въпроси
          </a>
        </nav>

        <CtaButton
          model="standard"
          className="min-h-11 px-4 py-2 text-base"
        >
          <ShoppingBag className="h-5 w-5" aria-hidden="true" />
          {/* Full label on wider screens, short label on very small screens */}
          <span className="hidden min-[400px]:inline">Поръчай сега</span>
          <span className="min-[400px]:hidden">Поръчай</span>
        </CtaButton>
      </div>
    </header>
  )
}
