import { cn } from '@/lib/utils'

// Crayon annotation layer. Used exactly twice on the page — sparse is the
// whole point; everywhere and it becomes noise.
//
// Both paths carry pathLength="1" so the draw-on dash maths in globals.css is
// unit-free and stays correct no matter how the geometry is edited. The
// arrowhead is the second path and is delayed after the shaft (see the
// nth-child rule in globals.css).
export function DoodleArrow({
  flip = false,
  delay = 0,
  className,
}: {
  /** Mirror horizontally, so a pair of arrows can converge on one point. */
  flip?: boolean
  delay?: number
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 100 96"
      fill="none"
      aria-hidden="true"
      style={{ '--doodle-delay': `${delay}ms` } as React.CSSProperties}
      className={cn('doodle-draw', flip && '-scale-x-100', className)}
    >
      <path
        pathLength="1"
        d="M8 6C16 46 42 74 88 80"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        pathLength="1"
        d="M70 62L88 80L68 90"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
