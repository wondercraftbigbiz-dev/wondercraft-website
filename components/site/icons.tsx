// Hand-authored icon set, replacing stock Lucide glyphs used across the
// site. Consistent stroke weight (1.75) and fully rounded caps/joins give
// the brand its own line quality instead of a generic icon-library look.
// Props mirror Lucide's usage pattern (className, aria-hidden, ...rest) so
// call sites need no changes beyond swapping the import.

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function LeafIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 21c-4.5-1-8-5-8-9.5C4 6 8 3 12 3s8 3 8 8.5c0 4.5-3.5 8.5-8 9.5z" />
      <path d="M12 21V9" />
    </svg>
  )
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.5v5l3.25 1.9" />
    </svg>
  )
}

export function RecycleIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5a8.5 8.5 0 1 0 7.6 12.3" />
      <path d="M19.5 12.2l1 3.6-3.8-1" />
    </svg>
  )
}

export function PackageIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 8.5 12 4l8 4.5" />
      <path d="M4 8.5v8L12 21l8-4.5v-8" />
      <path d="M4 8.5 12 13l8-4.5" />
      <path d="M12 13v8" />
    </svg>
  )
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" />
      <path d="M9 12.2l2 2 4-4.2" />
    </svg>
  )
}

export function StarIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 2.5l2.7 6.4 6.9.6-5.2 4.6 1.6 6.8L12 17.3l-6 3.6 1.6-6.8-5.2-4.6 6.9-.6L12 2.5z" />
    </svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 12.5l5 5L20 6" />
    </svg>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 5l14 14" />
      <path d="M19 5L5 19" />
    </svg>
  )
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </svg>
  )
}

export function BagIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 8h10l1 12H6L7 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  )
}

// FAQ plus/minus toggle — CSS-driven morph (two bars, one collapses) rather
// than a rotated glyph, so open/close reads as a distinct state change.
export function PlusMinusIcon({
  isOpen,
  className,
}: {
  isOpen: boolean
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-block shrink-0 ${className ?? ''}`}
    >
      <span className="absolute inset-0 m-auto h-[1.75px] w-3.5 rounded-full bg-current" />
      <span
        className={`absolute inset-0 m-auto h-3.5 w-[1.75px] origin-center rounded-full bg-current transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          isOpen ? 'scale-y-0' : 'scale-y-100'
        }`}
      />
    </span>
  )
}
