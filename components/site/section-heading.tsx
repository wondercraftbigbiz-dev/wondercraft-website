import { cn } from '@/lib/utils'
import { Reveal } from './reveal'

type SectionHeadingProps = {
  /** Must match the owning section's aria-labelledby. */
  id: string
  /** Small uppercase kicker above the title. Omit on closing beats
   *  (guarantee, final CTA) so they don't read as another list item. */
  eyebrow?: string
  title: string
  lede?: string
  align?: 'start' | 'center'
  /** 'inverse' for the charcoal band, where text sits on a dark surface. */
  tone?: 'default' | 'inverse'
  /** 'lg' bumps the title to the display step for the final CTA. */
  size?: 'default' | 'lg'
  /** Set false when the caller already wraps this in a Reveal — nesting two
   *  would run the fade-up twice on the same content. */
  reveal?: boolean
  className?: string
}

// One canonical section heading. Before this existed the same 100-character
// class string was copy-pasted verbatim across six sections and had already
// drifted in three of them, so the page had no single place to tune its
// typographic rhythm.
export function SectionHeading({
  id,
  eyebrow,
  title,
  lede,
  align = 'start',
  tone = 'default',
  size = 'default',
  reveal = true,
  className,
}: SectionHeadingProps) {
  const centered = align === 'center'
  const inverse = tone === 'inverse'
  const Wrapper = reveal ? Reveal : 'div'

  return (
    <Wrapper className={cn(centered && 'text-center', className)}>
      {eyebrow && (
        <p
          className={cn(
            'text-eyebrow font-semibold uppercase tracking-[0.14em]',
            inverse ? 'text-cream/60' : 'text-charcoal-soft',
          )}
        >
          {eyebrow}
        </p>
      )}

      <h2
        id={id}
        className={cn(
          'text-balance font-display tracking-[-0.015em]',
          size === 'lg'
            ? 'text-h2 font-bold md:text-display'
            : 'text-h2 font-semibold md:text-h2-lg',
          eyebrow && 'mt-3',
          'max-w-2xl',
          centered && 'mx-auto',
          inverse ? 'text-cream' : 'text-charcoal',
        )}
      >
        {title}
      </h2>

      {lede && (
        <p
          className={cn(
            'mt-3 max-w-xl text-pretty text-base leading-relaxed',
            centered && 'mx-auto',
            inverse ? 'text-cream/70' : 'text-charcoal-soft',
          )}
        >
          {lede}
        </p>
      )}
    </Wrapper>
  )
}
