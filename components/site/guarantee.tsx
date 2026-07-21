import { ShieldCheck } from 'lucide-react'
import { Section } from './section'
import { CtaButton } from './cta-button'
import { Reveal } from './reveal'

export function Guarantee() {
  return (
    <Section id="guarantee" labelledBy="guarantee-heading">
      <Reveal>
        <div className="flex flex-col items-start gap-6 rounded-[4px] border-2 border-charcoal bg-sage p-8 md:flex-row md:items-center md:gap-10 md:p-12">
          <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[4px] border-2 border-charcoal bg-cream">
            <ShieldCheck className="h-7 w-7 text-coral" aria-hidden="true" />
          </span>
          <div className="flex-1">
            <h2
              id="guarantee-heading"
              className="font-display text-[28px] font-semibold leading-[1.15] tracking-[-0.015em] text-charcoal md:text-3xl"
            >
              30 дни право на връщане
            </h2>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-charcoal-soft">
              Ако къщичката не отговаря на очакванията ви, върнете я в рамките на
              30 дни и ще възстановим сумата. Без излишни въпроси.
            </p>
          </div>
          <div className="shrink-0">
            <CtaButton />
          </div>
        </div>
      </Reveal>
    </Section>
  )
}
