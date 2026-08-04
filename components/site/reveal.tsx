'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

// Fade-up (or unfold) on scroll, fires once via IntersectionObserver.
export function Reveal({
  children,
  className,
  as: Tag = 'div',
  delay = 0,
  variant = 'fade',
}: {
  children: React.ReactNode
  className?: string
  as?: React.ElementType
  /** Stagger delay in ms, applied via the --reveal-delay CSS variable. */
  delay?: number
  /** 'fade' (default) for repeated content; 'unfold' for high-stakes, one-off moments. */
  variant?: 'fade' | 'unfold'
}) {
  const ref = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.disconnect()
          }
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref}
      style={delay ? ({ '--reveal-delay': `${delay}ms` } as React.CSSProperties) : undefined}
      className={cn(
        variant === 'unfold' ? 'reveal-unfold' : 'reveal',
        visible && 'is-visible',
        className,
      )}
    >
      {children}
    </Tag>
  )
}
