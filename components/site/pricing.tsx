import Image from 'next/image'
import { plans } from '@/lib/data/pricing'
import { CtaButton } from './cta-button'
import { CheckIcon } from './icons'
import { Reveal } from './reveal'
import { Section } from './section'
import { SectionHeading } from './section-heading'
import { TiltCard } from './tilt-card'

export function Pricing() {
  return (
    <Section
      id="pricing"
      labelledBy="pricing-heading"
      bandClassName="corrugation bg-kraft/40"
    >
      <SectionHeading
        id="pricing-heading"
        eyebrow="Модели и цени"
        title="Един ясен избор, две цени"
        lede="Без абонаменти и скрити такси. Изберете модела, който пасва на вашето дете."
      />

      {/* Narrower than the 1120px section cap on purpose: two cards read as a
          comparison only when both fit on screen together. */}
      <div className="mx-auto mt-10 grid max-w-[960px] gap-8 lg:grid-cols-2">
        {plans.map((plan, i) => (
          <Reveal key={plan.id} delay={i * 80}>
            <TiltCard className="h-full">
              <div
                className={`card-hover-lift flex h-full flex-col overflow-hidden rounded-lg border border-border-soft bg-cream ${
                  plan.featured ? 'shadow-soft-lg' : 'shadow-soft'
                }`}
              >
                {/* Corrugated top edge — the signature cardboard cross-section */}
                <div className="corrugation h-2.5 w-full bg-kraft" aria-hidden="true" />

                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-display text-h3 font-semibold text-charcoal">
                        {plan.name}
                      </h3>
                      {/* Reserve two lines once the cards sit side by side:
                          one tagline wraps and the other doesn't, which would
                          otherwise offset every row below it and break the
                          comparison the two-card layout exists for. */}
                      <p className="mt-1 text-sm text-charcoal-soft lg:min-h-[46px]">
                        {plan.tagline}
                      </p>
                    </div>
                    {plan.featured && (
                      <span className="shrink-0 rounded-full border border-border-soft-strong bg-salmon px-2.5 py-0.5 text-eyebrow font-semibold uppercase tracking-[0.08em] text-charcoal">
                        Любим избор
                      </span>
                    )}
                  </div>

                  {/* Product sits on an inset kraft mat rather than bleeding to
                      the card edge. Decoupling the image from the card width is
                      what keeps the card short; both photos are shot at 4:5 on a
                      seamless backdrop, so this ratio crops nothing. */}
                  <div className="mx-auto mt-4 w-full max-w-[260px] rounded-lg bg-kraft/40 p-4">
                    <div className="aspect-[4/5] overflow-hidden rounded-md border border-border-soft bg-cream">
                      <Image
                        src={plan.image}
                        alt={plan.imageAlt}
                        width={1122}
                        height={1402}
                        sizes="260px"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>

                  <div className="mt-5 flex items-baseline gap-2">
                    <span className="font-display text-3xl font-bold text-charcoal">
                      {plan.euro}
                    </span>
                    <span className="text-sm text-charcoal-soft">
                      ({plan.lev})
                    </span>
                  </div>

                  <ul className="mt-5 flex flex-col gap-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <CheckIcon
                          className="mt-1 h-4 w-4 shrink-0 text-salmon-deep"
                          aria-hidden="true"
                        />
                        <span className="text-[15px] leading-snug text-charcoal">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* mt-auto so both cards' buttons sit on the same baseline
                      even though the feature lists differ in length. */}
                  <div className="mt-auto pt-6">
                    <CtaButton
                      model={plan.id}
                      variant={plan.featured ? 'solid' : 'outline'}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </TiltCard>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}
