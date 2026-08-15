import { startingPrice } from '@/lib/data/pricing'
import { CtaButton } from './cta-button'
import { Reveal } from './reveal'
import { Section } from './section'
import { SectionHeading } from './section-heading'

export function FinalCta() {
  return (
    <Section
      id="final-cta"
      labelledBy="final-cta-heading"
      bandClassName="corrugation border-t border-border-soft bg-kraft"
    >
      <SectionHeading
        id="final-cta-heading"
        title="Подарете час след час игра"
        lede={`Изцяло от рециклиран картон, готова за 15 минути. От ${startingPrice.euro} (${startingPrice.lev}).`}
        align="center"
        size="lg"
      />

      <Reveal className="mt-8 flex justify-center">
        <CtaButton />
      </Reveal>
    </Section>
  )
}
