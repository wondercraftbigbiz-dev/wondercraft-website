import { startingPrice } from '@/lib/data/pricing'
import { CtaButton } from './cta-button'
import { Reveal } from './reveal'

export function FinalCta() {
  return (
    <section
      id="final-cta"
      aria-labelledby="final-cta-heading"
      className="corrugation border-y-2 border-charcoal bg-kraft px-5 py-16 md:py-24"
    >
      <div className="mx-auto w-full max-w-[1120px] text-center">
        <Reveal>
          <h2
            id="final-cta-heading"
            className="mx-auto max-w-2xl text-balance font-display text-[28px] font-bold leading-[1.1] tracking-[-0.015em] text-charcoal md:text-5xl"
          >
            Подарете час след час игра
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-charcoal-soft md:text-[17px]">
            Изцяло от рециклиран картон, готова за 15 минути. От{' '}
            {startingPrice.lev} / {startingPrice.euro}.
          </p>
          <div className="mt-8 flex justify-center">
            <CtaButton />
          </div>
        </Reveal>
      </div>
    </section>
  )
}
