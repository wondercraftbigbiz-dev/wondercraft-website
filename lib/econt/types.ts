/**
 * Two layers of types:
 *   Raw*  — what Econt returns, narrowed to the fields actually read.
 *   City/Office/ShippingQuote — the slimmed shapes sent to the browser.
 *
 * The Raw* shapes come from Econt's published documentation, not from a captured
 * response — the sandbox this was built in cannot reach demo.econt.com. Verify them
 * against a real payload before trusting them; nullability is where Econt's docs and
 * its actual JSON most often disagree. Every field below is therefore read
 * defensively.
 */

// ---------- raw (server-side only) ----------

export type RawCity = {
  id: number
  name?: string | null
  nameEn?: string | null
  postCode?: string | null
  regionName?: string | null
}

export type RawAddress = {
  fullAddress?: string | null
  city?: { name?: string | null } | null
  location?: { latitude?: number | null; longitude?: number | null } | null
}

export type RawOffice = {
  id: number
  code?: string | null
  name?: string | null
  nameEn?: string | null
  isAPS?: boolean | null
  address?: RawAddress | null
  normalBusinessHoursFrom?: number | string | null
  normalBusinessHoursTo?: number | string | null
}

export type RawLabelResponse = {
  label?: {
    totalPrice?: number | null
    courierServicePrice?: number | null
    currency?: string | null
  } | null
}

// ---------- slimmed (sent to the browser) ----------

export type City = {
  id: number
  name: string
  nameEn: string
  postCode: string
  regionName: string
}

export type Office = {
  id: number
  code: string
  name: string
  address: string
  workingHours: string | null
  lat: number | null
  lon: number | null
}

export type ShippingQuote = {
  /** Courier price in BGN, or null when Econt could not quote it. */
  total: number | null
  currency: string
}
