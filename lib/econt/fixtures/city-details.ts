import type { EcontQuarter, EcontStreet } from '../types'

/**
 * Streets and quarters per city, for address-mode delivery.
 *
 * Only a handful of cities are populated. A city that is absent returns empty
 * lists, which is the case the UI has to handle anyway — Econt's nomenclature
 * genuinely has no streets for most villages, which is why the freeform street
 * fallback exists.
 */
const STREETS: Record<number, string[]> = {
  41: [
    'бул. Александър Малинов', 'бул. Витоша', 'бул. Черни връх', 'бул. Мария Луиза',
    'ул. Раковски', 'ул. Граф Игнатиев', 'ул. Шипка', 'ул. Иван Вазов',
    'бул. Цариградско шосе', 'ул. Солунска', 'ул. Уилям Гладстон', 'бул. Патриарх Евтимий',
  ],
  56: [
    'ул. Иван Вазов', 'ул. Македония', 'бул. Шести септември', 'ул. Съединение',
    'бул. Марица', 'ул. Гладстон', 'ул. Райко Даскалов',
  ],
  68: [
    'бул. Владислав Варненчик', 'бул. Сливница', 'ул. Драгоман', 'бул. Осми Приморски полк',
    'ул. Преслав',
  ],
  72: ['ул. Александровска', 'ул. Богориди', 'бул. Демокрация'],
}

const QUARTERS: Record<number, string[]> = {
  41: ['Център', 'Лозенец', 'Младост 1', 'Младост 4', 'Люлин 3', 'Хладилника', 'Изток'],
  56: ['Център', 'Кючук Париж', 'Тракия', 'Смирненски'],
  68: ['Център', 'Младост', 'Чайка', 'Аспарухово'],
  72: ['Център', 'Лазур', 'Славейков'],
}

export function fixtureStreets(cityId: number): EcontStreet[] {
  return (STREETS[cityId] ?? []).map((name, i) => ({
    id: cityId * 1000 + i,
    cityID: cityId,
    name,
  }))
}

export function fixtureQuarters(cityId: number): EcontQuarter[] {
  return (QUARTERS[cityId] ?? []).map((name, i) => ({
    id: cityId * 1000 + 500 + i,
    cityID: cityId,
    name,
  }))
}
