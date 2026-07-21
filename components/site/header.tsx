'use client'

import { ShoppingBag } from 'lucide-react'
import { useContactModal } from './modal-context'

export function Header() {
  const { open } = useContactModal()

  return (
    <header className="sticky top-0 z-40 border-b-2 border-charcoal bg-cream/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between px-5">
        <a
          href="#hero"
          className="font-display text-xl font-bold tracking-tight text-charcoal"
        >
          Wondercraft
        </a>

        <nav
          aria-label="Основна навигация"
          className="hidden items-center gap-7 md:flex"
        >
          <a href="#pricing" className="text-sm text-charcoal hover:text-coral">
            Цени
          </a>
          <a href="#assembly" className="text-sm text-charcoal hover:text-coral">
            Сглобяване
          </a>
          <a href="#faq" className="text-sm text-charcoal hover:text-coral">
            Въпроси
          </a>
        </nav>

        <button
          type="button"
          onClick={() => open('standard')}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border-2 border-coral bg-coral px-4 py-2 font-display text-base font-semibold text-cream transition-transform duration-150 ease-out hover:scale-[1.02]"
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
