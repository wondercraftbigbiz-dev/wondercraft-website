import { ClockIcon, PackageIcon, RecycleIcon } from './icons'
import { Section } from './section'
import { Reveal } from './reveal'

const benefits = [
  {
    icon: ClockIcon,
    title: 'Готова за 15 минути',
    text: 'Без инструменти, без лепило. Панелите се прегъват и захващат — и къщичката е готова за игра.',
  },
  {
    icon: RecycleIcon,
    title: '100% рециклиран картон',
    text: 'Издръжлив, лек и напълно рециклируем. Безопасен избор за детето и за планетата.',
  },
  {
    icon: PackageIcon,
    title: 'Прибира се плоско',
    text: 'Когато не се използва, се разглобява и заема минимално място в гардероба или под леглото.',
  },
]

export function Benefits() {
  const [lead, ...rest] = benefits

  return (
    <Section id="benefits" labelledBy="benefits-heading">
      <Reveal>
        <h2
          id="benefits-heading"
          className="max-w-2xl text-balance font-display text-[26px] font-semibold leading-[1.15] tracking-[-0.015em] sm:text-[30px] text-charcoal md:text-4xl"
        >
          Направена да улесни живота ви
        </h2>
      </Reveal>

      {/* Bento layout: one anchor tile carries more weight than the two
          smaller ones stacked beside it, instead of three equal boxes. */}
      <div className="mt-10 grid gap-5 lg:grid-cols-3 lg:grid-rows-2">
        <Reveal className="lg:col-span-2 lg:row-span-2">
          <div className="card-hover-lift group flex h-full flex-col justify-center rounded-lg border border-border-soft bg-sage p-8 shadow-soft md:p-10">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-md border border-border-soft bg-cream transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:-translate-y-0.5 group-hover:-rotate-3">
              <lead.icon className="h-7 w-7 text-charcoal" aria-hidden="true" />
            </span>
            <h3 className="mt-5 font-display text-2xl font-semibold text-charcoal md:text-3xl">
              {lead.title}
            </h3>
            <p className="mt-3 max-w-md text-base leading-relaxed text-charcoal-soft md:text-[17px]">
              {lead.text}
            </p>
          </div>
        </Reveal>

        {rest.map((benefit, i) => (
          <Reveal key={benefit.title} delay={(i + 1) * 80}>
            <div className="card-hover-lift group h-full rounded-lg border border-border-soft bg-cream p-6 shadow-soft">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-md border border-border-soft bg-sage transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:-translate-y-0.5 group-hover:-rotate-3">
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
