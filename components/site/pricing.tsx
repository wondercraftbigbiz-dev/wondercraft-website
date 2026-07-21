import Image from 'next/image'
import { Check } from 'lucide-react'
import { plans } from '@/lib/data/pricing'
import { CtaButton } from './cta-button'
import { Reveal } from './reveal'

export function Pricing() {
  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="corrugation bg-kraft/40 px-5 py-14 md:py-24"
    >
      <div className="mx-auto w-full max-w-[1120px]">
        <Reveal>
          <h2
            id="pricing-heading"
            className="max-w-2xl text-balance font-display text-[28px] font-semibold leading-[1.15] tracking-[-0.015em] text-charcoal md:text-4xl"
          >
            Един ясен избор, две цени
          </h2>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-charcoal-soft">
            Без абонаменти и скрити такси. Изберете модела, който пасва на вашето
            дете.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {plans.map((plan) => (
            <Reveal key={plan.id}>
              <div className="flex h-full flex-col overflow-hidden rounded-[4px] border-2 border-charcoal bg-cream">
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
                      <span className="shrink-0 rounded-[4px] bg-coral px-3 py-1 font-display text-sm font-semibold text-cream">
                        Любим избор
                      </span>
                    )}
                  </div>

                  <div className="mt-5 aspect-[4/3] overflow-hidden rounded-[4px] border-2 border-charcoal">
                    <Image
                      src={plan.image}
                      alt={plan.imageAlt}
                      width={640}
                      height={480}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="mt-6 flex items-baseline gap-2">
                    <span className="font-display text-4xl font-bold text-charcoal">
                      {plan.lev}
                    </span>
                    <span className="text-base text-charcoal-soft">
                      / {plan.euro}
                    </span>
                  </div>

                  <ul className="mt-6 flex flex-col gap-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check
                          className="mt-0.5 h-5 w-5 shrink-0 text-coral"
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
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
