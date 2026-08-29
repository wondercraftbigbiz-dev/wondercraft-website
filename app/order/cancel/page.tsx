import Link from 'next/link'

export const metadata = {
  title: 'Поръчката е отменена — Wondercraft',
}

export default function OrderCancelPage() {
  return (
    <section className="flex min-h-[70vh] items-center justify-center px-5 py-20">
      <div className="mx-auto max-w-md text-center">
        <h1 className="font-display text-3xl font-bold text-charcoal">
          Плащането е отменено
        </h1>
        <p className="mt-4 text-base leading-relaxed text-charcoal-soft">
          Поръчката не е завършена. Можете да опитате отново, когато сте готови.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-md border border-border-soft bg-salmon px-6 py-3 font-sans text-base font-semibold text-charcoal shadow-soft transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5 hover:bg-salmon-hover hover:shadow-soft-lg active:scale-[0.96] active:duration-100"
        >
          Обратно към началото
        </Link>
      </div>
    </section>
  )
}
