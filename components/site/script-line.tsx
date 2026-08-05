import { cn } from '@/lib/utils'

// The handwritten voice. One short line under a headline, never more — it is
// the warmth that stops the large display type from reading corporate.
export function ScriptLine({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p
      className={cn(
        'font-script text-[clamp(24px,3vw,40px)] leading-[1.25] text-charcoal-soft',
        className,
      )}
    >
      {children}
    </p>
  )
}
