import { Star } from 'lucide-react'
import { testimonials } from '@/lib/data/testimonials'
import { Section } from './section'
import { Reveal } from './reveal'

export function Testimonials() {
  return (
    <Section id="testimonials" labelledBy="testimonials-heading">
      <Reveal>
        <h2
          id="testimonials-heading"
          className="max-w-2xl text-balance font-display text-[28px] font-semibold leading-[1.15] tracking-[-0.015em] text-charcoal md:text-4xl"
        >
          Какво казват родителите
        </h2>
      </Reveal>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {testimonials.map((t) => (
          <Reveal key={t.name}>
            <figure className="flex h-full flex-col rounded-[4px] border-2 border-charcoal bg-cream p-6">
              <div className="flex gap-1" aria-label="Оценка пет от пет звезди">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-5 w-5 fill-coral text-coral"
                    aria-hidden="true"
                  />
                ))}
              </div>
              <blockquote className="mt-4 flex-1 text-pretty text-base leading-relaxed text-charcoal">
                {t.quote}
              </blockquote>
              <figcaption className="mt-5 text-sm text-charcoal-soft">
                <span className="font-medium text-charcoal">{t.name}</span> ·{' '}
                {t.location}
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}
