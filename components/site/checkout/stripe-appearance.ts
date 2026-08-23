import type { Appearance } from '@stripe/stripe-js'

/**
 * Theming for the Payment Element, so the card fields are indistinguishable
 * from the name and phone inputs above them.
 *
 * The values below are hex literals, duplicated from app/globals.css on purpose:
 * the Payment Element renders in a cross-origin iframe, so `var(--color-cream)`
 * means nothing inside it. Anything that changes in the `@theme inline` block or
 * in `.modal-input` has to be mirrored here by hand — there is no mechanism that
 * can do it, which is why they are named in the comments below.
 */

// From app/globals.css @theme inline.
const CREAM = '#fdf9f4'
const CHARCOAL = '#222222'
const CHARCOAL_SOFT = '#5a5450'
const SALMON_DEEP = '#fba196'
const BORDER_SOFT = '#e4d9c9'
const RADIUS_MD = '14px'

export const stripeAppearance: Appearance = {
  // 'flat' is the closest base to this form: no elevation, no default focus
  // ring, borders doing the work. 'stripe' would fight the paper aesthetic.
  theme: 'flat',
  variables: {
    colorPrimary: SALMON_DEEP,
    colorBackground: CREAM,
    colorText: CHARCOAL,
    colorTextSecondary: CHARCOAL_SOFT,
    colorTextPlaceholder: CHARCOAL_SOFT,
    // Errors reuse salmon-deep, which is already what aria-invalid turns the
    // real inputs. A second red would read as a different system.
    colorDanger: SALMON_DEEP,
    borderRadius: RADIUS_MD,
    spacingUnit: '4px',
    // Inter is served by next/font under a hashed filename, so the iframe cannot
    // load it. system-ui is the honest fallback; shipping a duplicate woff2 to
    // /public to close a gap this small is not worth the bytes.
    fontFamily: 'Inter, system-ui, sans-serif',
    // Exactly 16px. Anything smaller makes iOS Safari zoom on focus, which is
    // the same reason .modal-input pins it.
    fontSizeBase: '16px',
  },
  rules: {
    '.Input': {
      border: `1px solid ${BORDER_SOFT}`,
      backgroundColor: CREAM,
      boxShadow: 'none',
      // Matches .modal-input's 0.625rem 0.75rem.
      padding: '10px 12px',
      transition: 'border-color 150ms ease-out',
    },
    // .modal-input:focus-visible changes the border rather than adding a ring.
    '.Input:focus': {
      border: `1px solid ${SALMON_DEEP}`,
      boxShadow: 'none',
      outline: 'none',
    },
    '.Input--invalid': {
      border: `1px solid ${SALMON_DEEP}`,
      color: CHARCOAL,
      boxShadow: 'none',
    },
    '.Label': {
      color: CHARCOAL,
      fontWeight: '600',
      fontSize: '14px',
      marginBottom: '6px',
    },
    '.Error': {
      color: SALMON_DEEP,
      fontSize: '14px',
      fontWeight: '500',
      marginTop: '4px',
    },
  },
}
