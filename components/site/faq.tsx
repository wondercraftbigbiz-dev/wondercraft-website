'use client'

import { useId, useState } from 'react'
import { faqItems } from '@/lib/data/faq'
import { PlusMinusIcon } from './icons'
import { Section } from './section'
import { Reveal } from './reveal'

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const baseId = useId()

  return (
    <Section id="faq" labelledBy="faq-heading">
      <Reveal>
        <h2
          id="faq-heading"
          className="max-w-2xl text-balance font-display text-[28px] font-semibold leading-[1.15] tracking-[-0.015em] text-charcoal md:text-4xl"
        >
          Често задавани въпроси
        </h2>
      </Reveal>

      <Reveal>
        <ul className="mt-10 flex flex-col gap-3">
          {faqItems.map((item, i) => {
            const isOpen = openIndex === i
            const buttonId = `${baseId}-q-${i}`
            const panelId = `${baseId}-a-${i}`
            return (
              <li
                key={item.question}
                className="overflow-hidden rounded-lg border border-border-soft bg-cream shadow-soft"
              >
                <h3>
                  <button
                    type="button"
                    id={buttonId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-display text-lg font-semibold text-charcoal"
                  >
                    {item.question}
                    <PlusMinusIcon
                      isOpen={isOpen}
                      className={`h-5 w-5 ${isOpen ? 'text-jade-ink' : 'text-charcoal'}`}
                    />
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  aria-hidden={!isOpen}
                  className={`faq-panel ${isOpen ? 'is-open' : ''}`}
                >
                  <div>
                    <p className="px-5 pb-5 text-base leading-relaxed text-charcoal-soft">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </Reveal>
    </Section>
  )
}
