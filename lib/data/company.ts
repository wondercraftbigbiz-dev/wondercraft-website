/**
 * Company identity used by the legal pages and the footer.
 *
 * Every PLACEHOLDER value must be replaced with real registration data before
 * the myPOS store is submitted for review — see LEGAL-TODO.md. These are
 * deliberately loud so an unfilled value is impossible to miss on the page.
 */

const PLACEHOLDER = (what: string) => `[ПОПЪЛНИ: ${what}]`

export const company = {
  tradeName: 'Wondercraft',
  legalName: PLACEHOLDER('юридическо име, напр. „Уондъркрафт“ ЕООД'),
  eik: PLACEHOLDER('ЕИК'),
  vatNumber: PLACEHOLDER('ДДС номер или „не е регистриран по ЗДДС“'),
  address: PLACEHOLDER('адрес на управление'),
  email: PLACEHOLDER('имейл за поддръжка'),
  phone: PLACEHOLDER('телефон за поддръжка'),
  /** Where returned goods are sent. Often differs from the registered address. */
  returnsAddress: PLACEHOLDER('адрес за връщане на стоки'),
  courier: PLACEHOLDER('куриер, напр. Еконт / Спиди'),
  deliveryTime: PLACEHOLDER('срок на доставка, напр. 2–4 работни дни'),
  deliveryCost: 'Безплатна доставка за всички поръчки.',
  /** Consumer protection authorities, fixed values for Bulgaria. */
  authorities: {
    kzp: 'Комисия за защита на потребителите (КЗП), гр. София, пл. „Славейков“ №4А, ет. 3, тел. 0700 111 22, kzp.bg',
    cpdp: 'Комисия за защита на личните данни (КЗЛД), гр. София, бул. „Проф. Цветан Лазаров“ №2, cpdp.bg',
  },
} as const

/** True when any legal placeholder is still unfilled. */
export function hasUnfilledCompanyDetails(): boolean {
  return Object.values(company).some(
    (value) => typeof value === 'string' && value.startsWith('[ПОПЪЛНИ:'),
  )
}
