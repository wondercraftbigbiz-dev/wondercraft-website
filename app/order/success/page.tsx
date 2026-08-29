import Link from 'next/link'

export const metadata = {
  title: 'Поръчката е получена — Wondercraft',
}

export default function OrderSuccessPage() {
  return (
    <section className="flex min-h-[70vh] items-center justify-center px-5 py-20">
      <div className="mx-auto max-w-md text-center">
        <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full border border-border-soft bg-jade-tint">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-jade-ink">
            <path d="M4 12.5l5 5L20 6" />
          </svg>
        </span>
        <h1 className="mt-6 font-display text-3xl font-bold text-charcoal">
          Благодарим ви за поръчката!
        </h1>
        <p className="mt-4 text-base leading-relaxed text-charcoal-soft">
          Плащането ви е получено успешно. Ще се свържем с вас възможно най-скоро,
          за да потвърдим поръчката и доставката.
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
