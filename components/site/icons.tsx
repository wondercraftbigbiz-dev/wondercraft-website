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

export function StorefrontIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 9.5 4.5 4h15L21 9.5" />
      <path d="M4 9.5h16V20H4z" />
      <path d="M9.5 20v-5.5h5V20" />
    </svg>
  )
}

export function LockerIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 3h14v18H5z" />
      <path d="M5 9h14M5 15h14" />
      <path d="M15.5 6h1M15.5 12h1M15.5 18h1" />
    </svg>
  )
}

export function PinIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

export function CardIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 6.5h19v11h-19z" />
      <path d="M2.5 10.5h19" />
      <path d="M6 14.5h3" />
    </svg>
  )
}

export function BanknoteIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 6.5h19v11h-19z" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M5.5 9.5h.01M18.5 14.5h.01" />
    </svg>
  )
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m6 9.5 6 6 6-6" />
    </svg>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4 4" />
    </svg>
  )
}

export function AlertIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5" />
      <path d="M12 16.5h.01" />
    </svg>
  )
}

/**
 * Spinner. Note that globals.css clamps animation-duration for
 * prefers-reduced-motion, so this stops moving for those users — never let it
 * be the only indication that something is loading.
 */
export function SpinnerIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  )
}
