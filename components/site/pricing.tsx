import Image from 'next/image'
import { plans } from '@/lib/data/pricing'
import { CtaButton } from './cta-button'
import { CheckIcon } from './icons'
import { Reveal } from './reveal'
import { TiltCard } from './tilt-card'

export function Pricing() {
  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="corrugation bg-kraft/40 px-5 py-12 sm:px-6 sm:py-14 md:py-24"
    >
      <div className="mx-auto w-full max-w-[1120px]">
        <Reveal>
          <h2
            id="pricing-heading"
            className="max-w-2xl text-balance font-display text-[26px] font-semibold leading-[1.15] tracking-[-0.015em] sm:text-[30px] text-charcoal md:text-4xl"
          >
            Един ясен избор, две цени
          </h2>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-charcoal-soft">
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

                  <div className="flex flex-1 flex-col p-5 sm:p-6 md:p-8">
                    {/* flex-wrap + min-w-0: at 360px the card interior is ~270px, and
                        "Персонализиран" alone is ~180px of unbreakable display type.
                        Without these the shrink-0 badge was pushed past the card's
                        overflow-hidden edge and clipped. */}
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 lg:flex-nowrap">
                      <div className="order-2 min-w-0 lg:order-1 lg:flex-1">
                        <h3 className="font-display text-2xl font-semibold text-charcoal">
                          {plan.name}
                        </h3>
                        <p className="mt-1 text-base text-charcoal-soft">
                          {plan.tagline}
                        </p>
                      </div>
                      {plan.featured && (
                        // order flips the wrapped case: the badge leads the card
                        // on a phone instead of dangling under the tagline, and
                        // returns to the right of the title once the row fits.
                        <span className="order-1 shrink-0 rounded-full border border-border-soft-strong bg-salmon px-3 py-1 font-display text-sm font-semibold text-charcoal lg:order-2">
                          Любим избор
                        </span>
                      )}
                    </div>

                    <div className="mt-5 aspect-[4/3] overflow-hidden rounded-lg border border-border-soft bg-cream sm:aspect-[4/5]">
                      <Image
                        src={plan.image}
                        alt={plan.imageAlt}
                        width={1122}
                        height={1402}
                        className="h-full w-full object-cover"
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
