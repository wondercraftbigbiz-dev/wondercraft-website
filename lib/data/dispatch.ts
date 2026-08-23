// Where parcels leave from.
//
// Econt requires a sender on every shipment, even to price one, so none of this
// is optional once a quote is wanted. It used to live in eight ECONT_SENDER_*
// environment variables; it lives here instead because it is the shop's own
// address, not a secret, and it changes roughly never. In code it is
// version-controlled, reviewable, and a missing field is a typecheck failure
// rather than a runtime surprise a customer discovers.
//
// Deliberately dependency-free, like pricing.ts: the check scripts import it
// with bare node.

/**
 * The two ways a parcel can start its journey, as a union so the choice cannot
 * be half-made.
 *
 * Econt treats these as alternatives, not a blend: given an office code it
 * ignores the address entirely (see buildLabel in lib/econt/shipping.ts). Having
 * both set in a flat object was a quiet way to believe one thing and ship
 * another.
 */
export type Dispatch =
  | {
      kind: 'office'
      /** Shown on the label as the sender. */
      name: string
      /** Econt sends the courier SMS here. Bulgarian mobile, E.164. */
      phone: string
      /** The Econt office parcels are handed in at. */
      officeCode: string
    }
  | {
      kind: 'address'
      name: string
      phone: string
      cityName: string
      cityPostCode: string
      street: string
      streetNum: string
      /** Floor, entrance, anything that does not fit the fields above. */
      streetOther?: string
    }

// Parcels are handed in at Econt Благоевград Пазара, ул. Даме Груев 15 (office
// code 2712, city Благоевград id 4). Confirmed by the owner on 2026-08-23
// against the live office list (GET /api/econt/offices?cityId=4).
//
// Before this was filled in, every quote failed: Econt rejected the placeholder
// office code 0000 with `подател: ExInvalidCity`, the quote came back as an
// error, and the checkout disabled "Продължи към плащане" for every customer.
// If this office ever closes, take the new code from /api/econt/offices rather
// than guessing — the code is what Econt resolves the sender city from.
export const DISPATCH: Dispatch = {
  kind: 'office',
  name: 'WonderCraft',
  phone: '+359885147348',
  officeCode: '2712',
}

/**
 * True while DISPATCH is a guess rather than a real dispatch point.
 *
 * A separate flag rather than something inferred, for the same reason as
 * PARCEL_IS_PLACEHOLDER: once the values look plausible, nothing else in the
 * system can tell a real office code from an invented one.
 */
export const DISPATCH_IS_PLACEHOLDER = false
