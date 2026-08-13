import Image from 'next/image'
import { company } from '@/lib/data/company'

export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-border-soft bg-cream px-5 py-10">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <a href="/#hero" className="inline-block" aria-label="Wondercraft Начало">
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
          <a
            href="/#pricing"
            className="link-underline text-sm font-medium text-charcoal hover:text-salmon-deep"
          >
            Цени
          </a>
          <a
            href="/#assembly"
            className="link-underline text-sm font-medium text-charcoal hover:text-salmon-deep"
          >
            Сглобяване
          </a>
          <a
            href="/#faq"
            className="link-underline text-sm font-medium text-charcoal hover:text-salmon-deep"
          >
            Въпроси
          </a>
          <a
            href="/delivery-returns"
            className="link-underline text-sm font-medium text-charcoal hover:text-salmon-deep"
          >
            Доставка и връщане
          </a>
          <a
            href="/terms"
            className="link-underline text-sm font-medium text-charcoal hover:text-salmon-deep"
          >
            Общи условия
          </a>
          <a
            href="/privacy"
            className="link-underline text-sm font-medium text-charcoal hover:text-salmon-deep"
          >
            Поверителност
          </a>
        </nav>
      </div>

      {/* Company identity — required by EU distance-selling rules and checked
          during myPOS store onboarding. */}
      <div className="mx-auto mt-8 w-full max-w-[1120px] border-t border-border-soft pt-6">
        <div className="flex flex-col gap-2 text-sm text-charcoal-soft md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-1">
            <p>
              {company.legalName} · ЕИК {company.eik}
            </p>
            <p>{company.address}</p>
            <p>
              {company.email} · {company.phone}
            </p>
          </div>
          <p className="md:text-right">
            Плащанията с карта се обработват сигурно от myPOS.
            <br />
            Приемаме Visa и Mastercard.
          </p>
        </div>

        <p className="mt-6 text-sm text-charcoal-soft">
          © {year} Wondercraft. Всички права запазени.
        </p>
      </div>
    </footer>
  )
}
