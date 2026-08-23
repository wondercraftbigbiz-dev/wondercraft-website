import Image from 'next/image'
import { startingPrice } from '@/lib/data/pricing'
import { CtaButton } from './cta-button'
import { ClockIcon, LeafIcon, PackageIcon, ShieldIcon } from './icons'
import { Reveal } from './reveal'

const trustPoints = [
  { Icon: ClockIcon, label: '15 минути монтаж' },
  { Icon: PackageIcon, label: 'Прибира се плоско' },
  { Icon: ShieldIcon, label: '14 дни връщане' },
]

export function Hero() {
  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="px-5 pb-20 pt-8 sm:pb-24 sm:pt-10 md:px-8 md:pb-32 md:pt-16"
    >
      <div className="mx-auto grid w-full max-w-[1200px] items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        {/* display:contents on small screens lets the two copy blocks below
            interleave with the media in source-independent order (headline →
            video → offer). At lg the wrapper becomes a real box again and
            collapses them back into a single left-hand column cell. */}
        <div className="contents lg:block">
          <Reveal className="order-1" variant="unfold">
            <span className="inline-flex items-center gap-2 rounded-full border border-border-soft bg-sage px-3 py-1.5 text-sm font-semibold text-charcoal">
              <LeafIcon
                className="float-loop h-4 w-4 text-salmon-deep"
                aria-hidden="true"
              />
              100% рециклиран картон
            </span>

            {/* The dip at lg is deliberate: md is still single-column with a
                ~700px measure, while lg hands the headline a ~410px column.
                52px is the largest size that still breaks to three lines there. */}
            <h1
              id="hero-heading"
              className="mt-6 text-balance font-display text-[34px] font-bold leading-[1.05] tracking-[-0.02em] text-charcoal min-[400px]:text-[38px] sm:text-[46px] sm:leading-[1.02] md:text-[54px] lg:text-[52px] xl:text-[64px]"
            >
              Къщичка за игра, която{' '}
              <em className="italic text-salmon-deep">расте</em> с
              въображението
            </h1>
          </Reveal>

          <Reveal className="order-3 lg:mt-7" delay={80}>
            <p className="max-w-xl text-pretty text-base leading-relaxed text-charcoal-soft md:text-[17px]">
              Сглобява се за 15 минути без инструменти и се прибира плоско,
              когато не се използва. Изцяло от рециклиран картон — безопасна за
              детето и за планетата.
            </p>

            {/* Sans-serif on purpose: with the headline scaled down, keeping
                Playfair exclusive to the h1 is what preserves the hierarchy. */}
            <div className="mt-6 flex items-baseline gap-2">
              <span className="font-sans text-2xl font-semibold tracking-[-0.01em] text-charcoal">
                от {startingPrice.euro}
              </span>
              <span className="text-sm text-charcoal-soft">
                ({startingPrice.lev})
              </span>
            </div>

            <ul className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-charcoal-soft">
              {trustPoints.map(({ Icon, label }) => (
                <li key={label} className="inline-flex items-center gap-1.5">
                  <Icon
                    className="h-4 w-4 shrink-0 text-salmon-deep"
                    aria-hidden="true"
                  />
                  {label}
                </li>
              ))}
            </ul>

            <div className="mt-7">
              <CtaButton />
            </div>
          </Reveal>
        </div>

        {/* Capped while the layout is single-column: at 4:5 an uncapped frame
            is 880px tall on a tablet and pushes the CTA far off-screen. */}
        <Reveal
          className="relative order-2 mx-auto w-full max-w-[520px] lg:max-w-none"
          delay={140}
        >
          <div className="hero-parallax overflow-hidden rounded-xl border border-border-soft shadow-soft-lg">
            {/* Poster is a 4:5 opaque crop so it fills this box under any
                fit behaviour. The previous poster (house-hero.png) is 52%
                transparent — its real content is only 1024x491 — so it left
                an empty band here no matter what object-fit says.

                The frame is shallower than 4:5 on phones: at 360px a 4:5 box is
                400px tall, which on its own pushes the price and the CTA below
                the fold on every phone. object-cover crops the 4:5 source to
                suit. preload drops to metadata so a browser that blocks
                autoplay (iOS Low Power Mode) does not pull 1.9MB anyway. */}
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster="/images/hero-poster.jpg"
              aria-label="Дете рисува върху картонена къщичка за игра Wondercraft"
              className="aspect-[4/3] h-auto w-full object-cover sm:aspect-[4/5]"
            >
              <source src="/videos/kid-draws-on-house.mp4" type="video/mp4" />
            </video>
          </div>

          {/* Supporting photo, overlapping like a set-down print — breaks
              the single symmetric media block and tells the "made by hand"
              part of the story right in the hero. */}
          <div className="absolute -bottom-6 -left-2 hidden w-[42%] -rotate-6 overflow-hidden rounded-lg border-[6px] border-cream shadow-soft-lg sm:block md:-bottom-10 md:-left-6 lg:-left-12">
            {/* Pre-sized 4:3 crop rather than the 1MB square PNG: next/image
                runs with `unoptimized: true`, so whatever is referenced here
                is what ships. 560x420 covers the ~280px slot at 2x. */}
            <Image
              src="/images/hero-colouring.jpg"
              alt="Дете оцветява картонената къщичка с флумастер"
              width={560}
              height={420}
              sizes="(min-width: 1024px) 280px, 40vw"
              className="aspect-[4/3] h-auto w-full object-cover"
            />
          </div>
        </Reveal>
      </div>
    </section>
  )
}
