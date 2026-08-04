import Image from 'next/image'
import { Leaf } from 'lucide-react'
import { startingPrice } from '@/lib/data/pricing'
import { CtaButton } from './cta-button'
import { Reveal } from './reveal'

export function Hero() {
  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="px-5 pb-20 pt-14 md:pb-28 md:pt-20"
    >
      <div className="mx-auto grid w-full max-w-[1120px] items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <Reveal className="order-2 lg:order-1" variant="unfold">
          <span className="inline-flex items-center gap-2 rounded-full border border-border-soft bg-sage px-3 py-1.5 text-sm font-semibold text-charcoal">
            <Leaf
              className="float-loop h-4 w-4 text-salmon-deep"
              aria-hidden="true"
            />
            100% рециклиран картон
          </span>

          <h1
            id="hero-heading"
            className="mt-6 text-balance font-display text-[44px] font-bold leading-[0.98] tracking-[-0.02em] text-charcoal sm:text-6xl md:text-7xl lg:text-[84px]"
          >
            Къщичка за игра, която{' '}
            <em className="italic text-salmon-deep">расте</em> с
            въображението
          </h1>

          <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-charcoal-soft md:text-[17px]">
            Сглобява се за 15 минути без инструменти и се прибира плоско, когато
            не се използва. Изцяло от рециклиран картон — безопасна за детето и
            за планетата.
          </p>

          <div className="mt-7 flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold text-charcoal">
              от {startingPrice.euro}
            </span>
            <span className="text-base text-charcoal-soft">
              ({startingPrice.lev})
            </span>
          </div>

          <div className="mt-7">
            <CtaButton />
          </div>
        </Reveal>

        <Reveal className="relative order-1 lg:order-2" delay={140}>
          <div className="hero-parallax overflow-hidden rounded-xl border border-border-soft shadow-soft-lg">
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

          {/* Supporting photo, overlapping like a set-down print — breaks
              the single symmetric media block and tells the "made by hand"
              part of the story right in the hero. */}
          <div className="absolute -bottom-8 -left-6 hidden w-[38%] -rotate-6 overflow-hidden rounded-lg border-4 border-cream shadow-soft-lg sm:block lg:-left-10">
            <Image
              src="/images/assembly-2.png"
              alt="Ръце сглобяват картонените панели на къщичката"
              width={320}
              height={240}
              className="aspect-[4/3] h-auto w-full object-cover"
            />
          </div>
        </Reveal>
      </div>
    </section>
  )
}
