import { Leaf } from 'lucide-react'
import { startingPrice } from '@/lib/data/pricing'
import { CtaButton } from './cta-button'
import { Reveal } from './reveal'

export function Hero() {
  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="px-5 py-14 md:py-24"
    >
      <div className="mx-auto grid w-full max-w-[1120px] items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <Reveal className="order-2 lg:order-1">
          <span className="inline-flex items-center gap-2 rounded-[4px] bg-sage px-3 py-1.5 text-sm font-medium text-charcoal">
            <Leaf className="h-4 w-4 text-coral" aria-hidden="true" />
            100% рециклиран картон
          </span>

          <h1
            id="hero-heading"
            className="mt-5 text-balance font-display text-[36px] font-bold leading-[1.05] tracking-[-0.02em] text-charcoal md:text-6xl"
          >
            Къщичка за игра, която расте с въображението
          </h1>

          <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-charcoal-soft md:text-[17px]">
            Сглобява се за 15 минути без инструменти и се прибира плоско, когато
            не се използва. Изцяло от рециклиран картон — безопасна за детето и
            за планетата.
          </p>

          <div className="mt-6 flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold text-charcoal">
              от {startingPrice.euro}
            </span>
            <span className="text-base text-charcoal-soft">
              ({startingPrice.lev})
            </span>
          </div>

          <div className="mt-6">
            <CtaButton />
          </div>
        </Reveal>

        <Reveal className="order-1 lg:order-2">
          <div className="overflow-hidden rounded-[4px] border-2 border-charcoal">
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster="/images/house-hero.png"
              aria-label="Дете рисува върху картонена къщичка за игра Wondercraft"
              className="aspect-square h-auto w-full object-cover"
            >
              <source src="/videos/kid-draws-on-house.mp4" type="video/mp4" />
            </video>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
