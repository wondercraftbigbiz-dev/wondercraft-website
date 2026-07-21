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
    title: 'Сглобете за 15 минути',
    text: 'Прегънете и захванете панелите по маркировките. Без инструменти, без лепило.',
    image: '/images/assembly-2.png',
    alt: 'Ръце сглобяват картонените панели на къщичката',
  },
  {
    number: '3',
    title: 'Гледайте видеото',
    text: 'Всяка поръчка включва кратко видео ръководство, което показва всяка стъпка ясно.',
    image: '/images/assembly-3.png',
    alt: 'Напълно сглобена картонена къщичка за игра',
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

      <ol className="mt-10 grid gap-6 md:grid-cols-3">
        {steps.map((step) => (
          <Reveal key={step.number} as="li">
            <div className="h-full rounded-[4px] border-2 border-charcoal bg-cream">
              <div className="aspect-[4/3] overflow-hidden rounded-t-[2px] border-b-2 border-charcoal">
                <Image
                  src={step.image}
                  alt={step.alt}
                  width={480}
                  height={360}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-6">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-[4px] bg-coral font-display text-base font-semibold text-cream">
                  {step.number}
                </span>
                <h3 className="mt-4 font-display text-xl font-semibold text-charcoal">
                  {step.title}
                </h3>
                <p className="mt-2 text-base leading-relaxed text-charcoal-soft">
                  {step.text}
                </p>
              </div>
            </div>
          </Reveal>
        ))}
      </ol>
    </Section>
  )
}
