'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

// Fade-up on scroll, fires once via IntersectionObserver.
export function Reveal({
  children,
  className,
  as: Tag = 'div',
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  as?: React.ElementType
  /** Stagger delay in ms, applied via the --reveal-delay CSS variable. */
  delay?: number
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
      className={cn('reveal', visible && 'is-visible', className)}
    >
      {children}
    </Tag>
  )
}
