// Upstream e-Econt API shapes — only the fields we actually read.
//
// Econt returns plenty more; adding a field here is a deliberate act, because
// everything typed here has to survive their next release. Nothing in this file
// crosses to the browser — see dto.ts for that.

export type EcontCountry = {
  id: number
  code2: string
  code3: string
  name: string
  nameEn: string
}

export type EcontCity = {
  id: number
  country?: EcontCountry
  postCode: string
  name: string
  nameEn: string
  regionName?: string
  regionNameEn?: string
  phoneCode?: string
  /** Econt's own flag for whether express city delivery is offered. */
  expressCityDeliveries?: boolean
}

/**
 * A city as referenced from an address. Econt resolves it by `id`, or by `name`
 * + `postCode` — hence every field being optional, unlike EcontCity above which
 * is what the nomenclature returns.
 */
export type EcontCityRef = {
  id?: number
  name?: string
  nameEn?: string
  postCode?: string
  country?: EcontCountry
}

export type EcontAddress = {
  city?: EcontCityRef
  /** Full one-line address, when Econt composes it for us. */
  fullAddress?: string
  quarter?: string
  street?: string
  num?: string
  /** Free-form fallback for addresses Econt's street nomenclature lacks. */
  other?: string
  zip?: string
}

export type EcontOffice = {
  id: number
  /** The stable identifier used on shipments. Prefer this over `id`. */
  code: string
  /** Mobile post station (a van on a schedule), not a walk-in office. */
  isMPS?: boolean
  /** Automat / Econtomat — a 24/7 parcel locker. */
  isAPS?: boolean
  name: string
  nameEn?: string
  phones?: string[]
  emails?: string[]
  address?: EcontAddress
  info?: string
  currency?: string
  normalBusinessHoursFrom?: string
  normalBusinessHoursTo?: string
  halfDayBusinessHoursFrom?: string
  halfDayBusinessHoursTo?: string
}

export type EcontStreet = {
  id: number
  cityID?: number
  name: string
  nameEn?: string
}

export type EcontQuarter = {
  id: number
  cityID?: number
  name: string
  nameEn?: string
}

export type GetCitiesRequest = { countryCode: string }
export type GetCitiesResponse = { cities?: EcontCity[] }

export type GetOfficesRequest = { countryCode: string; cityID?: number }
export type GetOfficesResponse = { offices?: EcontOffice[] }

export type GetStreetsRequest = { cityID: number }
export type GetStreetsResponse = { streets?: EcontStreet[] }

export type GetQuartersRequest = { cityID: number }
export type GetQuartersResponse = { quarters?: EcontQuarter[] }

export type EcontClientProfile = {
  name: string
  phones: string[]
}

/** Shipment payload. `mode: 'calculate'` prices it without creating anything. */
export type EcontLabel = {
  senderClient: EcontClientProfile
  senderAddress?: EcontAddress
  senderOfficeCode?: string
  receiverClient: EcontClientProfile
  receiverAddress?: EcontAddress
  receiverOfficeCode?: string
  packCount: number
  shipmentType: 'PACK' | 'DOCUMENT' | 'PALLET' | 'CARGO'
  weight: number
  shipmentDescription?: string
  /** Declared value, used for insurance and cash-on-delivery. */
  services?: {
    cdAmount?: number
    cdType?: string
    cdCurrency?: string
    declaredValueAmount?: number
    declaredValueCurrency?: string
    smsNotification?: boolean
  }
  payAfterAccept?: boolean
  payAfterTest?: boolean
  holidayDeliveryDay?: string
}

export type CreateLabelRequest = {
  label: EcontLabel
  mode: 'calculate' | 'validate' | 'create'
}

/**
 * Price fields on the response.
 *
 * Which one to charge the customer depends on who pays, and Econt's docs are
 * ambiguous about it — resolvePrice() in shipping.ts picks in a documented
 * order and this must be confirmed against the real API on a preview deploy.
 */
export type EcontResultLabel = {
  shipmentNumber?: string
  currency?: string
  totalPrice?: number
  courierServicePrice?: number
  senderDueAmount?: number
  receiverDueAmount?: number
  pdfURL?: string
}

export type CreateLabelResponse = {
  label?: EcontResultLabel
}

/** Econt reports business-level problems inside a 200 response. */
export type EcontErrorPayload = {
  type?: string
  message?: string
  fields?: string[]
  errors?: Array<{ type?: string; message?: string; fields?: string[] }>
  validationErrors?: Array<{ type?: string; message?: string; fields?: string[] }>
}
