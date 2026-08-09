import type { EcontOffice } from '../types'

function city(id: number, name: string, postCode: string) {
  return { id, name, nameEn: '', postCode }
}

/**
 * Offices for the fixture cities.
 *
 * Includes the awkward shapes on purpose: an office with no phones, one with no
 * business hours, one with a name long enough to wrap, an MPS (mobile station,
 * which we do not offer), and a city whose only presence is an automat.
 */
export const fixtureOffices: EcontOffice[] = [
  // --- София (41): several offices and automats -----------------------------
  {
    id: 1001, code: '1010', name: 'Офис Младост 1', isAPS: false, isMPS: false,
    phones: ['0700 1 7000'], emails: ['mladost@econt.com'],
    address: { city: city(41, 'София', '1000'), street: 'бул. Александър Малинов', num: '51', quarter: 'Младост 1' },
    normalBusinessHoursFrom: '08:30', normalBusinessHoursTo: '18:30',
    halfDayBusinessHoursFrom: '09:00', halfDayBusinessHoursTo: '14:00', currency: 'BGN',
  },
  {
    id: 1002, code: '1011', name: 'Офис Център', isAPS: false, isMPS: false,
    phones: ['0700 1 7001'],
    address: { city: city(41, 'София', '1000'), street: 'ул. Раковски', num: '96', quarter: 'Център' },
    normalBusinessHoursFrom: '09:00', normalBusinessHoursTo: '19:00', currency: 'BGN',
  },
  {
    // No phones, no hours — both must render without crashing or lying.
    id: 1003, code: '1012', name: 'Офис Люлин', isAPS: false, isMPS: false,
    address: { city: city(41, 'София', '1000'), street: 'бул. Царица Йоанна', num: '15', quarter: 'Люлин 3' },
    currency: 'BGN',
  },
  {
    id: 1004, code: '1013',
    name: 'Автомат Мол Парадайс Център — партер, до входа от бул. Черни връх',
    isAPS: true, isMPS: false,
    address: { city: city(41, 'София', '1000'), street: 'бул. Черни връх', num: '100', quarter: 'Хладилника' },
    normalBusinessHoursFrom: '00:00', normalBusinessHoursTo: '23:59', currency: 'BGN',
  },
  {
    id: 1005, code: '1014', name: 'Автомат Метростанция Сердика', isAPS: true, isMPS: false,
    address: { city: city(41, 'София', '1000'), street: 'бул. Мария Луиза', num: '2' },
    normalBusinessHoursFrom: '05:00', normalBusinessHoursTo: '00:30', currency: 'BGN',
  },
  {
    // Mobile post station. We never offer these as a pickup choice.
    id: 1006, code: '1015', name: 'Мобилна поща София Изток', isAPS: false, isMPS: true,
    address: { city: city(41, 'София', '1000'), street: 'бул. Цариградско шосе', num: '111' },
    currency: 'BGN',
  },

  // --- Пловдив (56) --------------------------------------------------------
  {
    id: 2001, code: '4010', name: 'Офис Пловдив Център', isAPS: false, isMPS: false,
    phones: ['032 900 100'],
    address: { city: city(56, 'Пловдив', '4000'), street: 'ул. Иван Вазов', num: '12', quarter: 'Център' },
    normalBusinessHoursFrom: '08:30', normalBusinessHoursTo: '18:00', currency: 'BGN',
  },
  {
    id: 2002, code: '4011', name: 'Офис Кючук Париж', isAPS: false, isMPS: false,
    phones: ['032 900 101'],
    address: { city: city(56, 'Пловдив', '4000'), street: 'ул. Македония', num: '78', quarter: 'Кючук Париж' },
    normalBusinessHoursFrom: '09:00', normalBusinessHoursTo: '18:00', currency: 'BGN',
  },
  {
    id: 2003, code: '4012', name: 'Автомат Пловдив Тракия', isAPS: true, isMPS: false,
    address: { city: city(56, 'Пловдив', '4000'), street: 'ул. Съединение', num: '3', quarter: 'Тракия' },
    normalBusinessHoursFrom: '00:00', normalBusinessHoursTo: '23:59', currency: 'BGN',
  },

  // --- Варна (68) — enough offices to trigger the picker's filter input ----
  ...Array.from({ length: 9 }, (_, i): EcontOffice => ({
    id: 3001 + i,
    code: `90${String(10 + i).padStart(2, '0')}`,
    name: `Офис Варна ${i + 1}`,
    isAPS: false,
    isMPS: false,
    phones: ['052 900 200'],
    address: {
      city: city(68, 'Варна', '9000'),
      street: 'бул. Владислав Варненчик',
      num: String(10 + i * 7),
      quarter: i % 2 === 0 ? 'Център' : 'Младост',
    },
    normalBusinessHoursFrom: '08:30',
    normalBusinessHoursTo: '18:00',
    currency: 'BGN',
  })),

  // --- One office each, for the remaining ordinary cities ------------------
  ...[
    [72, 'Бургас', '8000', '8010', 'ул. Александровска', '21'],
    [84, 'Русе', '7000', '7010', 'ул. Николаевска', '5'],
    [91, 'Стара Загора', '6000', '6010', 'ул. Цар Симеон Велики', '108'],
    [103, 'Габрово', '5300', '5310', 'ул. Априловска', '7'],
    [118, 'Благоевград', '2700', '2710', 'ул. Тодор Александров', '33'],
    [126, 'Велико Търново', '5000', '5010', 'ул. Васил Левски', '17'],
    [134, 'Шумен', '9700', '9710', 'бул. Славянски', '12'],
    [205, 'Драгоман', '2230', '2231', 'ул. Захари Стоянов', '2'],
    [311, 'Калояново', '4180', '4181', 'ул. Възраждане', '4'],
    [312, 'Калояново', '8532', '8533', 'ул. Първа', '1'],
    [313, 'Калояново', '6070', '6071', 'ул. Гео Милев', '9'],
    [610, 'Големи Станчовци-Долно Черковище', '6439', '6440', 'ул. Единствена', '1'],
  ].map(([id, name, postCode, code, street, num]): EcontOffice => ({
    id: 4000 + Number(code),
    code: String(code),
    name: `Офис ${name}`,
    isAPS: false,
    isMPS: false,
    phones: ['0700 1 7000'],
    address: {
      city: city(Number(id), String(name), String(postCode)),
      street: String(street),
      num: String(num),
    },
    normalBusinessHoursFrom: '09:00',
    normalBusinessHoursTo: '17:30',
    currency: 'BGN',
  })),

  // --- Елин Пелин (420): automat only, no walk-in office -------------------
  {
    id: 5001, code: '2110', name: 'Автомат Елин Пелин', isAPS: true, isMPS: false,
    address: { city: city(420, 'Елин Пелин', '2100'), street: 'пл. Независимост', num: '1' },
    normalBusinessHoursFrom: '00:00', normalBusinessHoursTo: '23:59', currency: 'BGN',
  },

  // --- Габрово (103): the live API's actual types, which are not ours --------
  // Production getOffices took the office picker down with "e.trim is not a
  // function": Econt declares these fields as strings and then sends numbers for
  // some of them, and nulls where the docs promise a string. Casting is the
  // point of this record — it is what arrives on the wire, not what types.ts
  // claims arrives, and the mapping has to survive it.
  {
    id: 6001, code: 5311, name: 'Офис Габрово Север', isAPS: false, isMPS: false,
    phones: [null, 66123456], emails: null,
    address: {
      // Inlined rather than via city(): the helper's own signature would reject
      // the numeric post code this record exists to reproduce.
      city: { id: 103, name: 'Габрово', nameEn: '', postCode: 5300 },
      street: 'ул. Априловска', num: 12, quarter: null,
    },
    normalBusinessHoursFrom: 830, normalBusinessHoursTo: null, currency: 'BGN',
  } as unknown as EcontOffice,

  // Бабек (501) and Горни Окол (502) get nothing at all — on purpose.
]
