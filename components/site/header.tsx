'use client'

import Image from 'next/image'
import { ShoppingBag } from 'lucide-react'
import { useContactModal } from './modal-context'

export function Header() {
  const { open } = useContactModal()

  return (
    <header className="sticky top-0 z-40 border-b-2 border-charcoal bg-cream/95 backdrop-blur-sm">
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
          <a href="#pricing" className="text-sm font-medium text-charcoal hover:text-salmon">
            Цени
          </a>
          <a href="#assembly" className="text-sm font-medium text-charcoal hover:text-salmon">
            Сглобяване
          </a>
          <a href="#faq" className="text-sm font-medium text-charcoal hover:text-salmon">
            Въпроси
          </a>
        </nav>

        <button
          type="button"
          onClick={() => open('standard')}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border-2 border-charcoal bg-salmon px-4 py-2 font-display text-base font-semibold text-charcoal transition-all duration-150 ease-out hover:bg-salmon-hover hover:scale-[1.02]"
        >
          <ShoppingBag className="h-5 w-5" aria-hidden="true" />
          {/* Full label on wider screens, short label on very small screens */}
          <span className="hidden min-[400px]:inline">Поръчай сега</span>
          <span className="min-[400px]:hidden">Поръчай</span>
        </button>
      </div>
    </header>
  )
}
