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

// ============================================================================
// ⚠️  PLACEHOLDER — NOT A REAL DISPATCH POINT.
//
// The owner has not yet decided whether parcels are dropped at an Econt office
// or collected by a courier. Until they are, this is a guess that produces a
// label Econt would reject and a quote priced from the wrong origin.
//
// To fill in, pick ONE shape and delete the other:
//
//   { kind: 'office',  name, phone, officeCode }
//   { kind: 'address', name, phone, cityName, cityPostCode, street, streetNum }
//
// The office code is the one from your Econt contract or from the office list
// at /api/econt/offices — listing offices deliberately does not require a
// sender, precisely so it can be used to find this value.
//
// Set DISPATCH_IS_PLACEHOLDER to false in the SAME edit. Until you do,
// assertChargeable() in lib/payments/readiness.ts refuses live card charges.
// ============================================================================
export const DISPATCH: Dispatch = {
  kind: 'office',
  name: 'WonderCraft',
  phone: '+359000000000', // PLACEHOLDER
  officeCode: '0000', // PLACEHOLDER
}

/**
 * True while DISPATCH is a guess rather than a real dispatch point.
 *
 * A separate flag rather than something inferred, for the same reason as
 * PARCEL_IS_PLACEHOLDER: once the values look plausible, nothing else in the
 * system can tell a real office code from an invented one.
 */
export const DISPATCH_IS_PLACEHOLDER = true
