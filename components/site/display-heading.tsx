import { Fragment } from 'react'
import { cn } from '@/lib/utils'

type DisplayHeadingProps = {
  id?: string
  as?: 'h1' | 'h2'
  /**
   * The clause carrying the meaning. Always rendered in charcoal — 16:1 on
   * the ground. See `accent` for why this matters.
   */
  lead: string
  /**
   * The lighter clause. Laurieri sets this in white, which is ~1.15:1 on a
   * warm ground and fails WCAG outright — it is the one part of that design
   * not worth copying. charcoal-soft keeps the light/dark rhythm within a
   * single headline at 6.5:1, which clears AA for large text, so the clause
   * can carry real copy instead of having to be decorative.
   */
  accent?: string
  /** Render the lighter clause first, so a product can overlap the dark one. */
  accentFirst?: boolean
  size?: 'hero' | 'section'
  className?: string
}

// Two-tone display headline with a word-by-word entrance.
//
// The words are direct children of the heading (not nested inside per-clause
// wrappers) so that the `.stagger-words > span` selector in globals.css can
// reach them, and so the stagger index runs continuously left-to-right across
// both clauses instead of restarting at the colour change.
export function DisplayHeading({
  id,
  as: Tag = 'h2',
  lead,
  accent,
  accentFirst = false,
  size = 'section',
  className,
}: DisplayHeadingProps) {
  const clauses = accentFirst
    ? [
        { text: accent, tone: 'air' as const },
        { text: lead, tone: 'ink' as const },
      ]
    : [
        { text: lead, tone: 'ink' as const },
        { text: accent, tone: 'air' as const },
      ]

  let wordIndex = -1

  return (
    <Tag
      id={id}
      className={cn(
        'stagger-words text-balance font-display tracking-[-0.025em]',
        size === 'hero'
          ? 'text-[clamp(48px,9vw,128px)] font-extrabold leading-[0.92]'
          : 'text-[clamp(36px,6vw,82px)] font-bold leading-[0.94]',
        className,
      )}
    >
      {clauses.map(({ text, tone }) => {
        if (!text) return null
        const words = text.split(' ').filter(Boolean)

        return (
          <Fragment key={tone}>
            {words.map((word, i) => {
              wordIndex += 1
              return (
                <Fragment key={`${tone}-${i}`}>
                  <span
                    style={{ '--i': wordIndex } as React.CSSProperties}
                    className={
                      tone === 'ink' ? 'text-charcoal' : 'text-charcoal-soft'
                    }
                  >
                    {word}
                  </span>{' '}
                </Fragment>
              )
            })}
          </Fragment>
        )
      })}
    </Tag>
  )
}
