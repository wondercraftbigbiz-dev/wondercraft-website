import { CtaButton } from './cta-button'
import { ShieldIcon } from './icons'
import { Reveal } from './reveal'

// The one deliberate high-contrast beat on the page. It used to be a
// full-bleed band, which fought the single-ground rule now running through
// every section; contained in a pill it reads as an object sitting on the
// surface rather than a seam cutting across it.
export function Guarantee() {
  return (
    <section
      id="guarantee"
      aria-labelledby="guarantee-heading"
      className="relative px-5 py-10 md:py-16"
    >
      <div className="mx-auto w-full max-w-[1120px]">
        <Reveal>
          <div className="relative flex flex-col items-start gap-6 overflow-hidden rounded-[40px] bg-charcoal px-7 py-10 md:flex-row md:items-center md:gap-10 md:px-12 md:py-12">
            <div
              className="perforation-light absolute inset-x-0 top-0 h-px w-full"
              aria-hidden="true"
            />
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-cream/15 bg-cream/5">
              <ShieldIcon
                className="float-loop h-7 w-7 text-salmon"
                aria-hidden="true"
              />
            </span>
            <div className="flex-1">
              <h2
                id="guarantee-heading"
                className="font-display text-[28px] font-semibold leading-[1.15] tracking-[-0.015em] text-cream md:text-4xl"
              >
                30 дни право на връщане
              </h2>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-cream/70">
                Ако къщичката не отговаря на очакванията ви, върнете я в рамките на
                30 дни и ще възстановим сумата. Без излишни въпроси.
              </p>
            </div>
            <div className="shrink-0">
              <CtaButton />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
