'use client'

import { useEffect, useState } from 'react'
import { ArrowUpIcon } from './icons'

export function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      type="button"
      aria-label="Обратно към началото"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      // The safe-area inset belongs on the offset, not on padding: this box has a
      // fixed h-12, so padding-bottom only pushed the arrow up inside the button
      // instead of lifting the button clear of the iOS home indicator.
      className={`fixed right-5 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-40 inline-flex h-12 w-12 items-center justify-center rounded-md border border-border-soft bg-salmon text-charcoal shadow-soft transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5 hover:scale-105 hover:bg-salmon-hover hover:shadow-soft-lg active:scale-95 active:duration-100 ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <ArrowUpIcon className="h-5 w-5" aria-hidden="true" />
    </button>
  )
}
