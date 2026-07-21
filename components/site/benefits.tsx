import { Clock, Recycle, Package } from 'lucide-react'
import { Section } from './section'
import { Reveal } from './reveal'

const benefits = [
  {
    icon: Clock,
    title: 'Готова за 15 минути',
    text: 'Без инструменти, без лепило. Панелите се прегъват и захващат — и къщичката е готова за игра.',
  },
  {
    icon: Recycle,
    title: '100% рециклиран картон',
    text: 'Издръжлив, лек и напълно рециклируем. Безопасен избор за детето и за планетата.',
  },
  {
    icon: Package,
    title: 'Прибира се плоско',
    text: 'Когато не се използва, се разглобява и заема минимално място в гардероба или под леглото.',
  },
]

export function Benefits() {
  return (
    <Section id="benefits" labelledBy="benefits-heading">
      <Reveal>
        <h2
          id="benefits-heading"
          className="max-w-2xl text-balance font-display text-[28px] font-semibold leading-[1.15] tracking-[-0.015em] text-charcoal md:text-4xl"
        >
          Направена да улесни живота ви
        </h2>
      </Reveal>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {benefits.map((benefit, i) => (
          <Reveal key={benefit.title}>
            <div className="h-full rounded-[4px] border-2 border-charcoal bg-cream p-6">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-[4px] bg-sage">
                <benefit.icon
                  className="h-6 w-6 text-charcoal"
                  aria-hidden="true"
                />
              </span>
              <h3 className="mt-4 font-display text-xl font-semibold text-charcoal">
                {benefit.title}
              </h3>
              <p className="mt-2 text-base leading-relaxed text-charcoal-soft">
                {benefit.text}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}
