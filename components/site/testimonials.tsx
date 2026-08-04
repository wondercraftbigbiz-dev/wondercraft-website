import { testimonials } from '@/lib/data/testimonials'
import { StarIcon } from './icons'
import { Section } from './section'
import { Reveal } from './reveal'

// Scattered, hand-set-down treatment instead of three identical boxes —
// the middle quote sits raised and forward, the outer two tilt slightly.
const cardTreatment = [
  'lg:mt-6 lg:-rotate-2',
  'lg:z-10 lg:shadow-soft-lg',
  'lg:mt-8 lg:rotate-2',
]

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

      <div className="mt-14 grid gap-6 lg:grid-cols-3 lg:gap-8">
        {testimonials.map((t, i) => (
          <Reveal key={t.name} delay={i * 80}>
            <figure
              className={`card-hover-lift flex h-full flex-col rounded-lg border border-border-soft bg-cream p-6 shadow-soft transition-transform duration-300 ${cardTreatment[i] ?? ''}`}
            >
              <div className="flex gap-1" aria-label="Оценка пет от пет звезди">
                {Array.from({ length: 5 }).map((_, starIndex) => (
                  <StarIcon
                    key={starIndex}
                    className="h-5 w-5 fill-salmon-deep text-salmon-deep"
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
