import { PageShell } from './page-shell'

/**
 * Shared shell for the legal pages. Narrower measure than the marketing
 * sections because these are read as prose, not scanned.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  /** Human-readable date of the last substantive revision. */
  updated: string
  children: React.ReactNode
}) {
  return (
    <PageShell>
      <main className="px-5 py-14 md:py-20">
        <div className="mx-auto w-full max-w-[720px]">
          <h1 className="text-balance font-display text-[30px] font-semibold leading-[1.15] tracking-[-0.015em] text-charcoal md:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-charcoal-soft">
            Последна актуализация: {updated}
          </p>

          <div className="legal-prose mt-10">{children}</div>

          <p className="mt-14 border-t border-border-soft pt-6">
            <a
              href="/"
              className="link-underline text-sm font-medium text-charcoal hover:text-salmon-deep"
            >
              Обратно към началото
            </a>
          </p>
        </div>
      </main>
    </PageShell>
  )
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-9 first:mt-0">
      <h2 className="font-display text-xl font-semibold text-charcoal md:text-2xl">
        {heading}
      </h2>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  )
}
