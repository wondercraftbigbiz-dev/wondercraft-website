import Image from 'next/image'
import { startingPrice } from '@/lib/data/pricing'
import { CtaButton } from './cta-button'
import { LeafIcon } from './icons'
import { Reveal } from './reveal'

export function Hero() {
  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="px-5 py-6 md:px-8 lg:py-8"
    >
      {/* Locked to a single screen at lg: 8rem = the 64px sticky header plus
          64px of lg:py-8. The 1fr spacer rows top and bottom absorb whatever
          height the media does not use, so the copy stays optically centred
          without the media's row-span stretching the gaps between blocks. */}
      <div className="mx-auto w-full max-w-[1200px] lg:grid lg:min-h-[calc(100svh_-_8rem)] lg:grid-cols-[0.9fr_1.1fr] lg:grid-rows-[1fr_auto_auto_auto_1fr] lg:gap-x-16 lg:gap-y-0">
        {/* The fold. On mobile this is a fixed one-screen flex column holding
            exactly headline + video + price/CTA, with the video absorbing the
            leftover space — so the reserve is computed by the browser instead
            of hard-coded, and stays correct whatever the text metrics do. The
            description sits outside it and therefore below the fold. At lg
            the box dissolves and its children join the grid directly. */}
        <div className="flex h-[calc(100svh_-_7rem)] min-h-fit flex-col gap-6 lg:contents">
          <Reveal
            className="order-1 lg:col-start-1 lg:row-start-2"
            variant="unfold"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-border-soft bg-sage px-3 py-1.5 text-sm font-semibold text-charcoal">
              <LeafIcon
                className="float-loop h-4 w-4 text-salmon-deep"
                aria-hidden="true"
              />
              100% рециклиран картон
            </span>

            {/* leading-[1.1] + pb-1 is a clearance requirement, not taste: the
                italic „расте" sets Cyrillic р, a descender letter, which a
                tighter leading clips. The dip at lg is deliberate too — md is
                still single-column with a ~700px measure, while lg hands the
                headline a ~410px column. */}
            <h1
              id="hero-heading"
              className="mt-6 text-balance pb-1 font-display text-[34px] font-bold leading-[1.1] tracking-[-0.02em] text-charcoal sm:text-[40px] md:text-[48px] lg:text-[44px] xl:text-[52px]"
            >
              Къщичка за игра, която{' '}
              <em className="italic text-salmon-deep">расте</em> с
              въображението
            </h1>
          </Reveal>

          {/* flex-1 is what makes the mobile fold self-computing: the video
              takes whatever height the headline and the offer leave behind.
              min-h keeps it usable on very short viewports, at the cost of a
              little scrolling there. */}
          <Reveal
            className="order-2 flex min-h-[200px] w-full flex-1 justify-center lg:col-start-2 lg:row-span-5 lg:row-start-1 lg:block lg:min-h-0 lg:flex-none lg:self-center"
            delay={140}
          >
            {/* One box carries the ratio, the clipping and the positioning.
                On mobile it is a stretched flex child, so its height is the
                leftover space and the ratio derives the width — a percentage
                height would not work here, because the fold's own height is
                indefinite (min-height only). At lg the width comes from the
                column instead and the height follows, capped against the same
                one-screen budget as the grid. */}
            <div className="relative aspect-[4/5] w-auto max-w-full overflow-hidden rounded-xl border border-border-soft shadow-soft-lg lg:max-h-[calc(100svh_-_8rem)] lg:w-full">
              <video
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                aria-label="Дете рисува върху картонена къщичка за игра Wondercraft"
                className="h-full w-full object-cover"
              >
                <source src="/videos/kid-draws-on-house.mp4" type="video/mp4" />
              </video>

              {/* Supporting photo, overlapping like a set-down print. Inset
                  rather than hanging past the frame, so it costs no vertical
                  budget — and being inset means the frame's overflow-hidden
                  never actually clips it. */}
              <div className="absolute bottom-4 left-4 hidden w-[34%] -rotate-6 overflow-hidden rounded-lg border-[5px] border-cream shadow-soft-lg sm:block lg:bottom-6 lg:left-6">
                {/* Pre-sized 4:3 crop rather than the 1MB square PNG:
                    next/image runs with `unoptimized: true`, so whatever is
                    referenced here is what ships. */}
                <Image
                  src="/images/assembly-2-hero.jpg"
                  alt="Ръце сглобяват картонените панели на къщичката"
                  width={560}
                  height={420}
                  sizes="(min-width: 1024px) 220px, 34vw"
                  priority
                  className="aspect-[4/3] h-auto w-full object-cover"
                />
              </div>
            </div>
          </Reveal>

          <Reveal
            className="order-3 lg:col-start-1 lg:row-start-4 lg:mt-6"
            delay={80}
          >
            {/* Sans-serif on purpose: with the headline scaled down, keeping
                Playfair exclusive to the h1 is what preserves the hierarchy. */}
            <div className="flex items-baseline gap-2">
              <span className="font-sans text-2xl font-semibold tracking-[-0.01em] text-charcoal">
                от {startingPrice.euro}
              </span>
              <span className="text-sm text-charcoal-soft">
                ({startingPrice.lev})
              </span>
            </div>

            <div className="mt-5">
              <CtaButton />
            </div>
          </Reveal>
        </div>

        {/* Below the fold on mobile, in reading position at lg. */}
        <Reveal
          className="mt-6 lg:col-start-1 lg:row-start-3 lg:mt-6"
          delay={120}
        >
          <p className="max-w-xl text-pretty text-base leading-relaxed text-charcoal-soft md:text-[17px]">
            Сглобява се за 15 минути без инструменти и се прибира плоско, когато
            не се използва. Изцяло от рециклиран картон — безопасна за детето и
            за планетата.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
