// Econt integration config. Demo/test environment only — see implementation_econt_api.md.

/** Base URL and credentials. Server-only: never prefix these with NEXT_PUBLIC_. */
export const econtConfig = {
  baseUrl: process.env.ECONT_API_URL ?? 'https://demo.econt.com/ee/services',
  username: process.env.ECONT_USERNAME ?? '',
  password: process.env.ECONT_PASSWORD ?? '',
} as const

/** Bulgaria only, for now. */
export const COUNTRY_CODE = 'BGR'

/** Nomenclatures change rarely; cache for a day. Seconds. */
export const NOMENCLATURE_TTL = 86_400

// PLACEHOLDER VALUES — the real flat-packed box has not been measured yet.
// Every shipping price the prototype displays is computed from these, so the
// quotes are indicative only. Correcting them is a one-line edit here.
export const PARCEL = {
  weightKg: 5,
  widthCm: 80,
  heightCm: 60,
  depthCm: 15,
} as const

/** Origin for price calculations. */
export const SENDER = {
  cityName: 'Благоевград',
  postCode: '2700',
  street: 'ул. Тодор Александров',
  streetNum: '1',
  contactName: 'Wondercraft',
  phone: '0888000000',
} as const
