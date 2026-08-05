import Image from 'next/image'
import { DisplayHeading } from './display-heading'
import { DoodleArrow } from './doodle'
import { Section } from './section'
import { Reveal } from './reveal'
import { ScriptLine } from './script-line'

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
      <Reveal variant="plain">
        <DisplayHeading
          id="assembly-heading"
          lead="Сглобяването е"
          accent="част от забавата"
          className="max-w-[16ch]"
        />
        <ScriptLine className="mt-4">Петнайсет минути, край.</ScriptLine>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-charcoal-soft">
          Три прости стъпки и къщичката е готова. Видео ръководството премахва
          всякакво притеснение.
        </p>
      </Reveal>

      <Reveal variant="plain" className="relative mt-14">
        {/* Crayon arrows hopping step to step, drawn on as the row enters.
            Two on the whole page — used sparingly this charms, used on every
            section it becomes noise. They sit outside the <ol>, since only
            <li> is valid there. */}
        <DoodleArrow
          delay={260}
          className="absolute left-[27%] top-2 hidden w-16 text-salmon-deep md:block"
        />
        <DoodleArrow
          flip
          delay={520}
          className="absolute left-[60%] top-2 hidden w-16 text-salmon-deep md:block"
        />

        <ol className="grid gap-x-6 gap-y-12 md:grid-cols-3 md:gap-y-0">
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

            {/* Same stage treatment as the pricing shots, rotating through
                the accent colours so the three steps do not read as a row of
                identical tiles. */}
            <div
              className={`mt-5 rounded-xl p-3 ${
                ['bg-sage', 'bg-salmon/50', 'bg-kraft'][i]
              }`}
            >
              <Image
                src={step.image}
                alt={step.alt}
                width={480}
                height={360}
                className="aspect-[4/3] h-full w-full rounded-lg object-cover"
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
      </Reveal>
    </Section>
  )
}
