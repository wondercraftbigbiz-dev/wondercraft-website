import Image from 'next/image'
import { Section } from './section'
import { SectionHeading } from './section-heading'
import { Reveal } from './reveal'

const steps = [
  {
    number: '1',
    title: 'Разгънете панелите',
    text: 'Къщичката пристига плоско опакована. Извадете панелите — всичко необходимо е в кутията.',
    image: '/images/assembly-flat-pack.jpg',
    alt: 'Плоско опаковани картонени панели за къщичка на пода',
  },
  {
    number: '2',
    title: 'Прочетете инструкциите',
    text: 'Всяка поръчка включва кратко ръководство, което показва всяка стъпка ясно.',
    image: '/images/assembly-instructions.jpg',
    alt: 'Ръце държат телефон с ръководството за сглобяване',
  },
  {
    number: '3',
    title: 'Сглобете за 15 минути',
    text: 'Прегънете и захванете панелите по маркировките. Без инструменти, без лепило.',
    image: '/images/assembly-building.jpg',
    alt: 'Баща и дете сглобяват картонената къщичка заедно',
  },
]

export function Assembly() {
  return (
    <Section id="assembly" labelledBy="assembly-heading">
      <SectionHeading
        id="assembly-heading"
        eyebrow="Сглобяване"
        title="Сглобяването е част от забавата"
        lede="Три прости стъпки и къщичката е готова. Видео ръководството премахва всякакво притеснение."
      />

      <ol className="relative mt-10 grid gap-x-6 gap-y-12 md:grid-cols-3 md:gap-y-0">
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

            <h3 className="mt-5 font-display text-h3 font-semibold text-charcoal">
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
