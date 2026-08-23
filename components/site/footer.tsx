import Image from 'next/image'

export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-border-soft bg-cream px-5 py-10">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <a href="#hero" className="inline-block" aria-label="Wondercraft Начало">
            <Image
              src="/wondercraft-logo.png"
              alt=""
              width={600}
              height={131}
              className="h-10 w-auto object-contain"
            />
          </a>
          <p className="mt-2 max-w-sm text-sm text-charcoal-soft">
            Къщички за игра от 100% рециклиран картон. Направено с грижа за
            децата и планетата.
          </p>
        </div>

        <nav aria-label="Долна навигация" className="-my-2 flex flex-wrap gap-x-6">
          <a
            href="#pricing"
            className="link-underline inline-flex min-h-11 items-center text-sm font-medium text-charcoal hover:text-salmon-deep"
          >
            Цени
          </a>
          <a
            href="#assembly"
            className="link-underline inline-flex min-h-11 items-center text-sm font-medium text-charcoal hover:text-salmon-deep"
          >
            Сглобяване
          </a>
          <a
            href="#faq"
            className="link-underline inline-flex min-h-11 items-center text-sm font-medium text-charcoal hover:text-salmon-deep"
          >
            Въпроси
          </a>
        </nav>
      </div>

      <div className="mx-auto mt-8 w-full max-w-[1120px] border-t border-border-soft pt-6">
        <p className="text-sm text-charcoal-soft">
          © {year} Wondercraft. Всички права запазени.
        </p>
      </div>
    </footer>
  )
}
