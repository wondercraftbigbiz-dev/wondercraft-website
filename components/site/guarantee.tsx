import { CtaButton } from './cta-button'
import { ShieldIcon } from './icons'
import { Reveal } from './reveal'
import { Section } from './section'
import { SectionHeading } from './section-heading'

// The one deliberate high-contrast beat on the page — a full-bleed dark
// band that breaks the pastel-on-cream rhythm running through every other
// section, instead of a colored card floating on the same light canvas.
export function Guarantee() {
  return (
    <Section
      id="guarantee"
      labelledBy="guarantee-heading"
      bandClassName="bg-charcoal"
    >
      <div
        className="perforation-light absolute inset-x-0 top-0 h-px w-full"
        aria-hidden="true"
      />
      <Reveal>
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:gap-10">
          <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-cream/15 bg-cream/5">
            <ShieldIcon
              className="float-loop h-7 w-7 text-salmon"
              aria-hidden="true"
            />
          </span>
          <div className="flex-1">
            <SectionHeading
              id="guarantee-heading"
              title="30 дни право на връщане"
              lede="Ако къщичката не отговаря на очакванията ви, върнете я в рамките на 30 дни и ще възстановим сумата. Без излишни въпроси."
              tone="inverse"
              reveal={false}
            />
          </div>
          <div className="shrink-0">
            <CtaButton />
          </div>
        </div>
      </Reveal>
    </Section>
  )
}
