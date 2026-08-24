> **Superseded — kept for history only.**
>
> This plan was never fully applied: several of its values (cream, kraft, salmon,
> salmon-hover) never matched what shipped, and its `--color-teal-accent` was
> never added. It also specifies the mint `#D4F0E7` that the current system
> replaced. The live colour system is documented in **`DESIGN.md`**.

# Implementation Plan: Align Website Colors with Wondercraft Brand Palette

This implementation plan outlines the exact updates required to align the Wondercraft website design system, color tokens, typography contrast, logos, and UI components with the official Wondercraft brand palette (derived from the brand logo).

---

## 🎨 1. Brand Color Token Mapping

We will update CSS variables in `app/globals.css` and Tailwind theme configurations.

| Token Name | Old Value | New Value | Brand Description & Usage |
|---|---|---|---|
| `--color-cream` (Background Canvas) | `#faf8f5` (Cool Cream) | `#faf5ee` (Golden Wheat) | Main page canvas tone echoing the logo background |
| `--color-salmon` (Primary CTA Accent) | `#ff6b4a` (Orange Coral) | `#fba196` (Soft Salmon) | Primary button background, focus ring, highlight accents |
| `--color-salmon-hover` (CTA Hover) | `#ff5430` | `#f98b7e` | Deepened salmon tone on button hover |
| `--color-sage` (Secondary Accent) | `#e8f0ec` (Muted Gray-Green) | `#d4f0e7` (Mint/Teal Green) | Soft mint/teal green for badges, icon tiles, metrics bg |
| `--color-teal-accent` (Icon Accent) | `#ff6b4a` | `#5fb897` (Teal Green) | Icon line stroke / checkmarks / leaf icon accent |
| `--color-kraft` (Cardboard Surface) | `#e4d9c8` (Cool Tan) | `#ebdcc9` (Warm Kraft) | Pricing section, corrugation texture overlay background |
| `--color-charcoal` (Primary Text/Border) | `#222222` | `#222222` | Kept intact for high contrast text, borders, wordmarks |
| `--color-charcoal-soft` (Subtle Text) | `#5a5450` | `#5a5450` | Kept intact for body copy and secondary descriptions |

---

## 🎯 2. Component & Surface Updates

### A. Design System (`app/globals.css`)
- Update CSS variable `--color-cream` to `#faf5ee`
- Update CSS variable `--color-sage` to `#d4f0e7`
- Update CSS variable `--color-kraft` to `#ebdcc9`
- Add `--color-salmon` (`#fba196`) and `--color-salmon-hover` (`#f98b7e`)
- Update `:focus-visible` outline color from `var(--color-coral)` to `var(--color-salmon)`
- Recolor `.corrugation` utility mix to blend with the warm `#ebdcc9` kraft tone

### B. Header Component (`components/site/header.tsx`)
- Replace the plain text "Wondercraft" with the vector SVG logo (`public/wondercraft_logo_svg.svg`) scaled to fit within the `h-16` (64px) header height.
- Update header CTA "Поръчай сега" button to use soft salmon `#fba196` with `text-charcoal` for high contrast.
- Update link hover states to use salmon/charcoal.

### C. Hero Section (`components/site/hero.tsx`)
- Recolor badge background to soft mint/teal green (`bg-sage` -> `#d4f0e7`).
- Recolor Leaf icon to mint/teal green (`#5fb897`) or soft salmon (`#fba196`).
- Update primary CTA button to use the updated CtaButton component.

### D. Buttons & CTAs (`components/site/cta-button.tsx`)
- Solid CTA variant: set `bg-[#fba196] border-[#fba196] text-[#222222]` with hover state `hover:bg-[#f98b7e] hover:border-[#f98b7e]`.
- Outline CTA variant: maintain `border-2 border-charcoal text-charcoal` with warm hover feedback.

### E. Benefits Section (`components/site/benefits.tsx`)
- Update benefit card icon tile backgrounds to soft mint green (`bg-sage` -> `#d4f0e7`).
- Ensure cards sit cleanly on the new warm golden-wheat canvas (`#faf5ee`).

### F. Pricing Section (`components/site/pricing.tsx`)
- Warm up pricing container background (`bg-kraft/40` -> `#ebdcc9` warm kraft tone).
- Recolor "Любим избор" featured badge to soft salmon `#fba196` with `text-charcoal`.
- Recolor checkmarks (`Check` icons) to soft salmon `#fba196` or teal green `#5fb897`.
- Update card buttons to use new CTA styling.

### G. Assembly Section (`components/site/assembly.tsx`)
- Recolor step number badges (`1`, `2`, `3`) to soft salmon `#fba196` with `text-charcoal`.
- Ensure cards harmonize with warm golden-wheat background.

### H. Metrics Section (`components/site/metrics.tsx`)
- Recolor metric banner background (`bg-sage` -> `#d4f0e7` mint/teal green tone).
- Keep numerical text sharp in charcoal (`#222222`).

### I. Testimonials Section (`components/site/testimonials.tsx`)
- Recolor review star icons (`Star`) from orange-coral to soft salmon `#fba196`.

### J. Guarantee Section (`components/site/guarantee.tsx`)
- Recolor banner background to soft mint/teal green (`bg-sage` -> `#d4f0e7`).
- Recolor ShieldCheck icon from orange-coral to teal green `#5fb897` or soft salmon `#fba196`.

### K. FAQ Section (`components/site/faq.tsx`)
- Recolor expanded accordion `Plus` icon rotation state to soft salmon `#fba196`.

### L. Final CTA Section (`components/site/final-cta.tsx`)
- Recolor section background to warm kraft (`#ebdcc9`).
- Ensure CTA button uses soft salmon `#fba196` with charcoal text.

### M. Footer Component (`components/site/footer.tsx`)
- Embed the Wondercraft logo next to the brand title & tagline.
- Recolor top border to warm kraft (`#ebdcc9`).
- Update link hover states.

### N. Interactive Modals & Utilities (`contact-modal.tsx`, `back-to-top.tsx`)
- Contact modal submit button: soft salmon `#fba196` with charcoal text and hover state.
- Success confirmation check icon badge: soft salmon `#fba196` with charcoal icon.
- Back to Top floating button: soft salmon `#fba196` with `text-charcoal` and `border-charcoal`.

---

## 📋 Progress Tracking & Verification Checklist

Use this checklist to track execution across current and future agents/sessions:

### Phase 1: Color Tokens & Global Design System
- [ ] Update CSS custom properties in `app/globals.css` (`--color-cream: #faf5ee`, `--color-sage: #d4f0e7`, `--color-kraft: #ebdcc9`, `--color-salmon: #fba196`).
- [ ] Update focus-visible ring color to `--color-salmon`.
- [ ] Update `.corrugation` background linear gradient mix to match warm kraft.

### Phase 2: Logo Integration
- [ ] Insert Wondercraft logo (`wondercraft_logo_svg.svg`) in `components/site/header.tsx`.
- [ ] Insert Wondercraft logo (`wondercraft_logo_svg.svg`) in `components/site/footer.tsx`.
- [ ] Verify logo dimensions and responsiveness on mobile, tablet, and desktop viewports.

### Phase 3: Buttons & Core CTA Components
- [ ] Update `components/site/cta-button.tsx` to use `#fba196` (soft salmon) background, `#222222` charcoal text, and `#f98b7e` hover state.
- [ ] Update header "Order now" button to match salmon + charcoal contrast.
- [ ] Update contact modal submit button (`components/site/contact-modal.tsx`).
- [ ] Update back-to-top button (`components/site/back-to-top.tsx`).

### Phase 4: Page Section Aesthetic Refresh
- [ ] Update `components/site/hero.tsx` badge and icon colors.
- [ ] Update `components/site/benefits.tsx` icon tiles to soft mint green (`#d4f0e7`).
- [ ] Update `components/site/pricing.tsx` background, featured badge, and checkmarks.
- [ ] Update `components/site/assembly.tsx` step badges.
- [ ] Update `components/site/metrics.tsx` banner background to mint green (`#d4f0e7`).
- [ ] Update `components/site/testimonials.tsx` star icon colors to salmon.
- [ ] Update `components/site/guarantee.tsx` banner background and shield icon.
- [ ] Update `components/site/faq.tsx` accordion active state icons.
- [ ] Update `components/site/final-cta.tsx` background and CTA.
- [ ] Update `components/site/footer.tsx` divider borders and links.

### Phase 5: Verification & Polish
- [ ] Audit application for any remaining legacy orange-coral (`#ff6b4a`) or cool-cream (`#faf8f5`) references.
- [ ] Verify text accessibility & contrast ratios (charcoal on salmon/mint/cream).
- [ ] Test desktop & mobile navigation, modals, and interactive hover states.
