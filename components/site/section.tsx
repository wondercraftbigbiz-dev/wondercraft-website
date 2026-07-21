import { cn } from '@/lib/utils'

type SectionProps = {
  id: string
  labelledBy: string
  children: React.ReactNode
  className?: string
  /** Adds a full-bleed background band spanning the viewport. */
  bandClassName?: string
}

// Section wrapper: <section aria-labelledby> with consistent vertical padding.
// Content is capped at 1120px and centered; optional full-bleed band behind it.
export function Section({
  id,
  labelledBy,
  children,
  className,
  bandClassName,
}: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn('relative px-5 py-14 md:py-24', bandClassName, className)}
    >
      <div className="mx-auto w-full max-w-[1120px]">{children}</div>
    </section>
  )
}
