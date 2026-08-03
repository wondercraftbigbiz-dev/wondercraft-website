import { Reveal } from './reveal'

const metrics = [
  { value: '0', label: 'нужни инструменти' },
  { value: '15 мин', label: 'средно време за сглобяване' },
  { value: '100%', label: 'рециклиран картон' },
  { value: '30 дни', label: 'право на връщане' },
]

export function Metrics() {
  return (
    <section
      id="metrics"
      aria-labelledby="metrics-heading"
      className="corrugation border-y-2 border-charcoal bg-sage px-5 py-14 md:py-20"
    >
      <div className="mx-auto w-full max-w-[1120px]">
        <h2 id="metrics-heading" className="sr-only">
          Числа за Wondercraft
        </h2>
        <Reveal>
          <dl className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {metrics.map((metric) => (
              <div key={metric.label} className="text-center">
                <dt className="font-display text-4xl font-bold text-charcoal md:text-5xl">
                  {metric.value}
                </dt>
                <dd className="mt-2 text-base text-charcoal-soft">
                  {metric.label}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  )
}
