import { startingPrice } from '@/lib/data/pricing'
import { BadgeCircle } from './badge-circle'
import { CtaButton } from './cta-button'
import { DisplayHeading } from './display-heading'
import { HeroVideo } from './hero-video'
import { ClockIcon, PackageIcon, RecycleIcon } from './icons'
import { Reveal } from './reveal'
import { ScriptLine } from './script-line'

const claims = [
  { label: '100% рециклиран картон', icon: RecycleIcon },
  { label: '15 мин. сглобяване', icon: ClockIcon },
  { label: 'Без инструменти', icon: undefined },
  { label: 'Прибира се плоско', icon: PackageIcon },
]

export function Hero() {
  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="px-5 pb-16 pt-10 md:pb-20 md:pt-14"
    >
      <div className="mx-auto w-full max-w-[1120px]">
        <Reveal variant="plain">
          <DisplayHeading
            id="hero-heading"
            as="h1"
            size="hero"
            lead="Къщичка за игра, която"
            accent="расте с въображението"
            className="mx-auto max-w-[15ch] text-center"
          />
        </Reveal>

        {/* The media rides up over the tail of the headline. The overlap is
            what makes the composition read as built rather than stacked —
            and it is the release valve if the hero ever overruns the fold:
            deepen it before shrinking the type. */}
        <Reveal variant="plain" className="relative">
          <div className="hero-parallax relative z-10 mx-auto mt-[calc(clamp(8px,3vw,44px)*-1)] aspect-[4/5] w-full max-w-[420px] overflow-hidden rounded-xl border border-border-soft bg-kraft shadow-soft-lg lg:h-[min(52svh,520px)] lg:w-auto lg:max-w-none">
            <HeroVideo />
          </div>

          {/* Claim badges radiating from the product, on one shared axis at
              desktop; a plain grid underneath once there is no room to flank. */}
          <div className="mt-8 grid grid-cols-2 justify-items-center gap-4 sm:grid-cols-4 lg:mt-0">
            {claims.map((claim, i) => (
              <BadgeCircle
                key={claim.label}
                label={claim.label}
                icon={claim.icon}
                index={i}
                className={
                  [
                    'lg:absolute lg:top-[26%] lg:left-0',
                    'lg:absolute lg:top-[54%] lg:left-[11%]',
                    'lg:absolute lg:top-[54%] lg:right-[11%]',
                    'lg:absolute lg:top-[26%] lg:right-0',
                  ][i]
                }
              />
            ))}
          </div>
        </Reveal>

        <Reveal className="mt-8 flex flex-col items-center text-center" delay={80}>
          <ScriptLine>Направена на ръка в България.</ScriptLine>

          <p className="mt-3 max-w-xl text-pretty text-base leading-relaxed text-charcoal-soft md:text-[17px]">
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
      </div>
    </section>
  )
}
