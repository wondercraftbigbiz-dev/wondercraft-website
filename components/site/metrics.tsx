import { Reveal } from './reveal'

const metrics = [
  { value: 'Любима играчка', label: 'на семейства из цяла България' },
  { value: '15 мин', label: 'средно време за сглобяване' },
  { value: '100%', label: 'рециклиран картон' },
  { value: '30 дни', label: 'право на връщане' },
]

export function Metrics() {
  return (
    <section
      id="metrics"
      aria-labelledby="metrics-heading"
      className="corrugation border-y border-border-soft bg-sage px-5 py-14 md:py-20"
    >
      <div className="mx-auto w-full max-w-[1120px]">
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
              <dt className="text-balance font-display text-2xl font-bold text-charcoal md:text-4xl">
                {metric.value}
              </dt>
              <dd className="mt-2 text-base text-charcoal-soft">
                {metric.label}
              </dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  )
}
