import Image from 'next/image'
import { Section } from './section'
import { Reveal } from './reveal'

const steps = [
  {
    number: '1',
    title: 'Разгънете панелите',
    text: 'Къщичката пристига плоско опакована. Извадете панелите — всичко необходимо е в кутията.',
    image: '/images/assembly-1.png',
    alt: 'Плоско опаковани картонени панели за къщичка',
  },
  {
    number: '2',
    title: 'Гледайте видеото',
    text: 'Всяка поръчка включва кратко видео ръководство, което показва всяка стъпка ясно.',
    image: '/images/assembly-3.png',
    alt: 'Напълно сглобена картонена къщичка за игра',
  },
  {
    number: '3',
    title: 'Сглобете за 15 минути',
    text: 'Прегънете и захванете панелите по маркировките. Без инструменти, без лепило.',
    image: '/images/assembly-2.png',
    alt: 'Ръце сглобяват картонените панели на къщичката',
  },
]

export function Assembly() {
  return (
    <Section id="assembly" labelledBy="assembly-heading">
      <Reveal>
        <h2
          id="assembly-heading"
          className="max-w-2xl text-balance font-display text-[28px] font-semibold leading-[1.15] tracking-[-0.015em] text-charcoal md:text-4xl"
        >
          Сглобяването е част от забавата
        </h2>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-charcoal-soft">
          Три прости стъпки и къщичката е готова. Видео ръководството премахва
          всякакво притеснение.
        </p>
      </Reveal>

      <ol className="relative mt-14 grid gap-x-6 gap-y-12 md:grid-cols-3 md:gap-y-0">
        {/* Connecting perforation line threading the three steps together —
            replaces the three boxed, identical cards with a single path. */}
        <div
          className="perforation absolute inset-x-0 top-9 hidden h-px md:block"
          aria-hidden="true"
        />

        {steps.map((step, i) => (
          <Reveal
            key={step.number}
            as="li"
            delay={i * 100}
            className={i === 1 ? 'md:mt-10' : undefined}
          >
            <span className="relative z-10 inline-flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-cream bg-salmon shadow-soft-lg">
              <span className="font-display text-2xl font-bold text-charcoal">
                {step.number}
              </span>
            </span>

            <div className="mt-5 overflow-hidden rounded-xl border border-border-soft shadow-soft">
              <Image
                src={step.image}
                alt={step.alt}
                width={480}
                height={360}
                className="aspect-[4/3] h-full w-full object-cover"
              />
            </div>

            <h3 className="mt-5 font-display text-xl font-semibold text-charcoal">
              {step.title}
            </h3>
            <p className="mt-2 max-w-sm text-base leading-relaxed text-charcoal-soft">
              {step.text}
            </p>
          </Reveal>
        ))}
      </ol>
    </Section>
  )
}
