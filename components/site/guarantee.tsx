import { CtaButton } from './cta-button'
import { ShieldIcon } from './icons'
import { Reveal } from './reveal'

// The one deliberate high-contrast beat on the page — a full-bleed dark
// band that breaks the pastel-on-cream rhythm running through every other
// section, instead of a colored card floating on the same light canvas.
export function Guarantee() {
  return (
    <section
      id="guarantee"
      aria-labelledby="guarantee-heading"
      className="relative bg-charcoal px-5 py-16 md:py-24"
    >
      <div
        className="perforation-light absolute inset-x-0 top-0 h-px w-full"
        aria-hidden="true"
      />
      <div className="mx-auto w-full max-w-[1120px]">
        <Reveal>
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:gap-10">
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-cream/15 bg-cream/5">
              <ShieldIcon
                className="float-loop h-7 w-7 text-amber"
                aria-hidden="true"
              />
            </span>
            <div className="flex-1">
              <h2
                id="guarantee-heading"
                className="font-display text-[28px] font-semibold leading-[1.15] tracking-[-0.015em] text-cream md:text-4xl"
              >
                14 дни право на връщане
              </h2>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-cream/70">
                Ако къщичката не отговаря на очакванията ви, върнете я в рамките на
                14 дни и ще възстановим сумата. Без излишни въпроси.
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
