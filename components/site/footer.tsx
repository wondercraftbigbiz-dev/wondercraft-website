export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t-2 border-charcoal bg-cream px-5 py-10">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <span className="font-display text-xl font-bold text-charcoal">
            Wondercraft
          </span>
          <p className="mt-2 max-w-sm text-sm text-charcoal-soft">
            Къщички за игра от 100% рециклиран картон. Направено с грижа за
            децата и планетата.
          </p>
        </div>

        <nav aria-label="Долна навигация" className="flex flex-wrap gap-x-6 gap-y-2">
          <a href="#pricing" className="text-sm text-charcoal hover:text-coral">
            Цени
          </a>
          <a href="#assembly" className="text-sm text-charcoal hover:text-coral">
            Сглобяване
          </a>
          <a href="#faq" className="text-sm text-charcoal hover:text-coral">
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
