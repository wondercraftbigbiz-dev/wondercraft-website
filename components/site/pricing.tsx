import Image from 'next/image'
import { plans } from '@/lib/data/pricing'
import { CtaButton } from './cta-button'
import { DisplayHeading } from './display-heading'
import { CheckIcon } from './icons'
import { Reveal } from './reveal'
import { ScriptLine } from './script-line'
import { TiltCard } from './tilt-card'

export function Pricing() {
  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="px-5 py-14 md:py-24"
    >
      <div className="mx-auto w-full max-w-[1120px]">
        <Reveal variant="plain">
          <DisplayHeading
            id="pricing-heading"
            lead="Един ясен избор,"
            accent="две цени"
            className="max-w-[14ch]"
          />
          <ScriptLine className="mt-4">Без изненади на касата.</ScriptLine>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-charcoal-soft">
            Без абонаменти и скрити такси. Изберете модела, който пасва на вашето
            дете.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {plans.map((plan, i) => (
            <Reveal key={plan.id} delay={i * 80}>
              <TiltCard className="h-full">
                <div
                  className={`card-hover-lift flex h-full flex-col overflow-hidden rounded-lg border border-border-soft bg-cream ${
                    plan.featured ? 'shadow-soft-lg' : 'shadow-soft'
                  }`}
                >
                  {/* Corrugated top edge — the signature cardboard cross-section */}
                  <div className="corrugation h-3 w-full bg-kraft" aria-hidden="true" />

                  <div className="flex flex-1 flex-col p-6 md:p-8">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-display text-2xl font-semibold text-charcoal">
                          {plan.name}
                        </h3>
                        <p className="mt-1 text-base text-charcoal-soft">
                          {plan.tagline}
                        </p>
                      </div>
                      {plan.featured && (
                        <span className="shrink-0 rounded-full border border-border-soft-strong bg-salmon px-3 py-1 font-display text-sm font-semibold text-charcoal">
                          Любим избор
                        </span>
                      )}
                    </div>

                    {/* Coloured stage under the product shot. A flat shape
                        behind a photo is the cheapest way to make an ordinary
                        product image look art-directed. Once the cutouts land,
                        drop the inner rounding and let the house overflow the
                        stage's top edge. */}
                    <div
                      className={`mt-5 rounded-lg p-4 ${
                        plan.featured ? 'bg-sage' : 'bg-salmon/50'
                      }`}
                    >
                      <Image
                        src={plan.image}
                        alt={plan.imageAlt}
                        width={640}
                        height={480}
                        className="aspect-[4/3] h-full w-full rounded-md object-cover"
                      />
                    </div>

                    <div className="mt-6 flex items-baseline gap-2">
                      <span className="font-display text-4xl font-bold text-charcoal">
                        {plan.euro}
                      </span>
                      <span className="text-base text-charcoal-soft">
                        ({plan.lev})
                      </span>
                    </div>

                    <ul className="mt-6 flex flex-col gap-3">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                          <CheckIcon
                            className="mt-0.5 h-5 w-5 shrink-0 text-salmon-deep"
                            aria-hidden="true"
                          />
                          <span className="text-base leading-relaxed text-charcoal">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-8 pt-2">
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
      </div>
    </section>
  )
}
