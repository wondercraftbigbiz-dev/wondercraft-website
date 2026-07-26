import Image from 'next/image'

export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t-2 border-charcoal bg-cream px-5 py-10">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <a href="#hero" className="inline-block" aria-label="Wondercraft Начало">
            <Image
              src="/wondercraft_logo_svg.svg"
              alt="Wondercraft Logo"
              width={150}
              height={40}
              className="h-10 w-auto object-contain"
            />
          </a>
          <p className="mt-2 max-w-sm text-sm text-charcoal-soft">
            Къщички за игра от 100% рециклиран картон. Направено с грижа за
            децата и планетата.
          </p>
        </div>

        <nav aria-label="Долна навигация" className="flex flex-wrap gap-x-6 gap-y-2">
          <a href="#pricing" className="text-sm font-medium text-charcoal hover:text-salmon">
            Цени
          </a>
          <a href="#assembly" className="text-sm font-medium text-charcoal hover:text-salmon">
            Сглобяване
          </a>
          <a href="#faq" className="text-sm font-medium text-charcoal hover:text-salmon">
            Въпроси
          </a>
        </nav>
      </div>

      <div className="mx-auto mt-8 w-full max-w-[1120px] border-t-2 border-kraft pt-6">
        <p className="text-sm text-charcoal-soft">
          © {year} Wondercraft. Всички права запазени.
        </p>
      </div>
    </footer>
  )
}
