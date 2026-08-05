import type { SVGProps } from 'react'
import { cn } from '@/lib/utils'

type BadgeCircleProps = {
  label: string
  icon?: React.ComponentType<SVGProps<SVGSVGElement>>
  /** Stagger position, drives the pop-in delay via the --i custom property. */
  index?: number
  className?: string
}

// The brand atom. One shape — the circle — carried across unrelated roles
// (claims, logo, corner tabs) is most of what reads as "designed".
// Cream on charcoal is 15:1, so unlike the display type these badges are
// safe to use for real information.
export function BadgeCircle({
  label,
  icon: Icon,
  index = 0,
  className,
}: BadgeCircleProps) {
  return (
    <span
      style={{ '--i': index } as React.CSSProperties}
      className={cn(
        'badge-pop inline-flex size-[92px] shrink-0 flex-col items-center justify-center gap-1 rounded-full bg-charcoal px-3 text-center font-sans text-[11px] font-semibold uppercase leading-[1.15] tracking-[0.04em] text-cream ring-2 ring-cream/50 ring-offset-2 ring-offset-ground md:size-[112px] md:text-xs',
        className,
      )}
    >
      {Icon && <Icon className="size-4 text-salmon" aria-hidden={true} />}
      {label}
    </span>
  )
}
