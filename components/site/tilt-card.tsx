'use client'

import { useRef } from 'react'
import { cn } from '@/lib/utils'

// Low-amplitude, pointer-tracked 3D tilt. Mouse-only (checked per event, so a
// stray synthetic pointerdown from touch never triggers it) and the actual
// rotation only ever applies under the `(hover: hover) and (pointer: fine)`
// media query in globals.css — belt-and-suspenders for touch devices, which
// get zero listener overhead *and* zero visual effect either way.
export function TiltCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== 'mouse') return
    const node = ref.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    node.style.setProperty('--tilt-x', `${(-py * 6).toFixed(2)}deg`)
    node.style.setProperty('--tilt-y', `${(px * 6).toFixed(2)}deg`)
  }

  function resetTilt() {
    const node = ref.current
    if (!node) return
    node.style.setProperty('--tilt-x', '0deg')
    node.style.setProperty('--tilt-y', '0deg')
  }

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
      className={cn('tilt-card', className)}
    >
      {children}
    </div>
  )
}
