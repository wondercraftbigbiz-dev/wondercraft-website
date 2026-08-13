import type { EcontCity } from '../types'

const BG = { id: 1033, code2: 'BG', code3: 'BGR', name: 'България', nameEn: 'Bulgaria' }

/**
 * A small stand-in for Econt's ~5000-settlement nomenclature.
 *
 * Chosen to cover the cases that break UIs, not to be representative:
 * duplicate names across regions, a city with no offices at all, a city with
 * only an automat, and a name long enough to overflow a dropdown row.
 * Coverage lives in the data — see fixtures/offices.ts for the other half.
 */
export const fixtureCities: EcontCity[] = [
  { id: 41, country: BG, postCode: '1000', name: 'София', nameEn: 'Sofia', regionName: 'София-град', regionNameEn: 'Sofia-grad', expressCityDeliveries: true },
  { id: 56, country: BG, postCode: '4000', name: 'Пловдив', nameEn: 'Plovdiv', regionName: 'Пловдив', regionNameEn: 'Plovdiv', expressCityDeliveries: true },
  { id: 68, country: BG, postCode: '9000', name: 'Варна', nameEn: 'Varna', regionName: 'Варна', regionNameEn: 'Varna', expressCityDeliveries: true },
  { id: 72, country: BG, postCode: '8000', name: 'Бургас', nameEn: 'Burgas', regionName: 'Бургас', regionNameEn: 'Burgas', expressCityDeliveries: true },
  { id: 84, country: BG, postCode: '7000', name: 'Русе', nameEn: 'Ruse', regionName: 'Русе', regionNameEn: 'Ruse' },
  { id: 91, country: BG, postCode: '6000', name: 'Стара Загора', nameEn: 'Stara Zagora', regionName: 'Стара Загора', regionNameEn: 'Stara Zagora' },
  { id: 103, country: BG, postCode: '5300', name: 'Габрово', nameEn: 'Gabrovo', regionName: 'Габрово', regionNameEn: 'Gabrovo' },
  { id: 118, country: BG, postCode: '2700', name: 'Благоевград', nameEn: 'Blagoevgrad', regionName: 'Благоевград', regionNameEn: 'Blagoevgrad' },
  { id: 126, country: BG, postCode: '5000', name: 'Велико Търново', nameEn: 'Veliko Tarnovo', regionName: 'Велико Търново', regionNameEn: 'Veliko Tarnovo' },
  { id: 134, country: BG, postCode: '9700', name: 'Шумен', nameEn: 'Shumen', regionName: 'Шумен', regionNameEn: 'Shumen' },

  // Same name, different regions and post codes. The UI must never key on name.
  { id: 205, country: BG, postCode: '2230', name: 'Драгоман', nameEn: 'Dragoman', regionName: 'София', regionNameEn: 'Sofia' },
  { id: 311, country: BG, postCode: '4180', name: 'Калояново', nameEn: 'Kaloyanovo', regionName: 'Пловдив', regionNameEn: 'Plovdiv' },
  { id: 312, country: BG, postCode: '8532', name: 'Калояново', nameEn: 'Kaloyanovo', regionName: 'Бургас', regionNameEn: 'Burgas' },
  { id: 313, country: BG, postCode: '6070', name: 'Калояново', nameEn: 'Kaloyanovo', regionName: 'Стара Загора', regionNameEn: 'Stara Zagora' },

  // Only an automat — `office` delivery must be unavailable here.
  { id: 420, country: BG, postCode: '2100', name: 'Елин Пелин', nameEn: 'Elin Pelin', regionName: 'София', regionNameEn: 'Sofia' },

  // No Econt presence at all — offers must collapse to address delivery.
  { id: 501, country: BG, postCode: '4327', name: 'Бабек', nameEn: 'Babek', regionName: 'Пловдив', regionNameEn: 'Plovdiv' },
  { id: 502, country: BG, postCode: '2087', name: 'Горни Окол', nameEn: 'Gorni Okol', regionName: 'София', regionNameEn: 'Sofia' },

  // Deliberately long, to test truncation in the combobox row.
  { id: 610, country: BG, postCode: '6439', name: 'Големи Станчовци-Долно Черковище', nameEn: 'Golemi Stanchovtsi-Dolno Cherkovishte', regionName: 'Хасково', regionNameEn: 'Haskovo' },
]
