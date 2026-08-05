import Image from 'next/image'
import { startingPrice } from '@/lib/data/pricing'
import { CtaButton } from './cta-button'
import { HeroVideo } from './hero-video'
import { LeafIcon } from './icons'
import { Reveal } from './reveal'

export function Hero() {
  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="px-5 pb-20 pt-14 md:pb-28 md:pt-20"
    >
      <div className="mx-auto grid w-full max-w-[1240px] items-center gap-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-14">
        <Reveal className="order-2 lg:order-1" variant="unfold">
          <span className="inline-flex items-center gap-2 rounded-full border border-border-soft bg-sage px-3 py-1.5 text-sm font-semibold text-charcoal">
            <LeafIcon
              className="float-loop h-4 w-4 text-salmon-deep"
              aria-hidden="true"
            />
            100% рециклиран картон
          </span>

          <h1
            id="hero-heading"
            className="mt-6 text-balance font-display text-[44px] font-bold leading-[0.98] tracking-[-0.02em] text-charcoal sm:text-6xl md:text-7xl lg:text-[76px]"
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

        <Reveal
          className="relative order-1 mx-auto w-full max-w-[520px] lg:order-2 lg:mx-0 lg:ml-auto lg:w-auto lg:max-w-none"
          delay={60}
        >
          {/* Portrait frame: the clip is natively 9:16, so a tall block both
              shows more of it and gives the media the weight to lead the
              hero. At lg the height is driven off the viewport so the frame
              can never push the CTA below the fold. */}
          <div className="hero-parallax aspect-[4/5] w-full overflow-hidden rounded-xl border border-border-soft bg-kraft shadow-soft-lg lg:h-[min(76svh,720px)] lg:w-auto">
            <HeroVideo />
          </div>

          {/* Supporting photo, overlapping like a set-down print — breaks
              the single symmetric media block and tells the "made by hand"
              part of the story right in the hero. */}
          <div className="absolute -bottom-10 -left-8 hidden w-[42%] -rotate-6 overflow-hidden rounded-lg border-4 border-cream shadow-soft-lg sm:block lg:-left-12">
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
