import { Reveal } from './reveal'
import { Section } from './section'

const metrics = [
  { value: 'Любима играчка', label: 'на семейства из цяла България' },
  { value: '15 мин', label: 'средно време за сглобяване' },
  { value: '100%', label: 'рециклиран картон' },
  { value: '30 дни', label: 'право на връщане' },
]

export function Metrics() {
  return (
    <Section
      id="metrics"
      labelledBy="metrics-heading"
      bandClassName="corrugation border-b border-border-soft bg-sage"
    >
      {/* Cream meets sage here with no heading to mark the change. The
          perforation stands in for a plain border so the transition reads as
          a deliberate beat — the same die-cut motif threading the steps above. */}
      <div
        className="perforation absolute inset-x-0 top-0 h-px w-full"
        aria-hidden="true"
      />
      <h2 id="metrics-heading" className="sr-only">
        Числа за Wondercraft
      </h2>
      <dl className="grid grid-cols-2 gap-8 lg:grid-cols-4">
        {metrics.map((metric, i) => (
          <Reveal
            as="div"
            key={metric.label}
            delay={i * 70}
            className="text-center"
          >
            <dt className="text-balance font-display text-h2 font-bold text-charcoal md:text-h2-lg">
              {metric.value}
            </dt>
            <dd className="mt-2 text-base text-charcoal-soft">
              {metric.label}
            </dd>
          </Reveal>
        ))}
      </dl>
    </Section>
  )
}
