# Wondercraft — Design System

The colour system for wondercraft.bg. Read this before changing any colour.

Everything lives in the `@theme inline` block of `app/globals.css`. There is no
`tailwind.config.*` — Tailwind v4 generates every `bg-*` / `text-*` / `border-*` /
`fill-*` utility directly from the `--color-*` names below.

---

## 1. Brand primitives

The eight official Wondercraft colours, derived from the logo
(`public/wondercraft_logo_svg.svg`). These are the source of truth.

| Name | Hex | Role |
|---|---|---|
| Amber | `#FEC86E` | highlight |
| Ink | `#2C2925` | warm near-black |
| Lavender | `#BBA8E3` | **reserved — no role on this surface** |
| Jade | `#70C3A4` | affirm / calm |
| Salmon | `#FAA297` | commit / action |
| Stone | `#736F6D` | warm grey |
| Mist | `#E8E4E1` | neutral surface |
| Sand | `#F6CD92` | cardboard warmth |

Lavender is a real brand colour and is deliberately unused here. Salmon, amber
and jade already form a complete three-accent system; a fourth hue would turn a
composed palette into a fruit salad. Do not reach for it to "use all eight."

---

## 2. The three-accent rule

This is the rule that keeps the page from looking generic. Follow it exactly.

> **Salmon commits.** Only things the visitor clicks to buy or submit.
> **Amber highlights.** Notable but not clickable: featured, rated, guaranteed, sequenced.
> **Jade affirms.** Included, confirmed, growing, secondary navigation.

The failure mode this replaced: one accent doing eight unrelated jobs at once.
When a colour means everything, it means nothing, and the eye stops finding the
CTA. If you are about to paint something salmon, first ask whether the visitor
clicks it. If not, it is amber or jade.

---

## 3. Semantic tokens

| Token | Value | Notes |
|---|---|---|
| **Canvas & surfaces** | | |
| `--color-cream` | `#FDF9F4` | page canvas, card surfaces |
| `--color-kraft` | `#F7E4C6` | cardboard bands (Final CTA, pricing card top edge) |
| `--color-kraft-wash` | `#FCF1E2` | lighter cardboard wash (Pricing section) |
| `--color-mist` | `#E8E4E1` | neutral UI chrome: modal aside, control tracks, hover rows |
| `--color-jade-tint` | `#E1EEE4` | jade at 20% over cream: badges, icon tiles, info notes |
| `--color-jade-tint-strong` | `#D6EADE` | jade at 28% over cream: Benefits lead tile |
| **Ink** | | |
| `--color-charcoal` | `#2C2925` | all headings and primary text |
| `--color-charcoal-soft` | `#5F5B58` | body and supporting copy |
| `--color-stone` | `#736F6D` | icon strokes, meta text on cream, disabled |
| **Borders** | | |
| `--color-border-soft` | `#E4D9C9` | default hairline |
| `--color-border-soft-strong` | `#D8C9B3` | emphasis hairline, perforation dots |
| **Action** | | |
| `--color-salmon` | `#FAA297` | CTA fill |
| `--color-salmon-hover` | `#F58A7D` | CTA hover |
| `--color-salmon-soft` | `#FDE9E3` | alert background tint |
| **Highlight** | | |
| `--color-amber` | `#FEC86E` | featured badge, stars, step numbers, guarantee icon |
| `--color-amber-ink` | `#A9741C` | amber-family icon strokes needing 3:1 |
| **Affirm** | | |
| `--color-jade` | `#70C3A4` | the solid Metrics band |
| `--color-jade-ink` | `#2F7357` | checkmarks, links, focus ring, jade-family text |
| **Semantic** | | |
| `--color-error` | `#B0453A` | error borders and text |

### Values that are not brand colours, and why

Four tokens are deliberately outside the eight. This is intentional, not drift.

- `--color-charcoal-soft #5F5B58`, `--color-jade-ink #2F7357`, `--color-amber-ink #A9741C`
  are **darkened derivatives** of stone / jade / amber. The brand values are too
  light to carry text or icons on cream. Brand stone `#736F6D` passes AA on cream
  (4.7:1) but drops to 3.9:1 on kraft, and body copy sits on both.
- `--color-error #B0453A` is outside the palette on purpose. An error state that
  looks like a brand accent reads as decoration rather than as a problem.

---

## 4. Contrast

Verified by computed WCAG 2.1 relative luminance. AA needs 4.5:1 for body text,
3:1 for large text and icons.

| Foreground | Background | Ratio | |
|---|---|---|---|
| charcoal | cream | 13.0:1 | AAA |
| charcoal | kraft | 10.8:1 | AAA |
| charcoal | mist | 10.6:1 | AAA |
| charcoal | jade | 6.5:1 | AA |
| charcoal | salmon | 7.0:1 | AA |
| charcoal | salmon-hover | 5.8:1 | AA |
| charcoal | amber | 9.0:1 | AAA |
| charcoal-soft | cream | 6.5:1 | AA |
| charcoal-soft | kraft | 5.4:1 | AA |
| charcoal-soft | mist | 5.4:1 | AA |
| stone | cream | 4.7:1 | AA (cream only) |
| jade-ink | cream | 5.4:1 | AA |
| amber-ink | cream | 3.8:1 | icons / large text only |
| error | cream | 5.2:1 | AA |
| error | salmon-soft | 4.9:1 | AA |
| amber | charcoal band | 9.0:1 | AAA |
| cream | charcoal band | 13.0:1 | AAA |

### Banned pairs

- **`charcoal-soft` on `jade`** — 3.2:1, fails AA. On the Metrics band both the
  values and the labels use solid `charcoal`; hierarchy comes from size and
  weight, not from a washed-out second colour.
- **Any accent as body text at its brand value.** Salmon `#FAA297` on cream is
  1.9:1. Use `jade-ink` or `error` for coloured text; never `salmon` or `amber`.

---

## 5. Page rhythm

| Section | Background |
|---|---|
| Header | `cream/95` + blur |
| Hero | cream, jade-tint badge |
| Benefits | cream, jade-tint-strong lead tile |
| Pricing | kraft-wash, amber featured badge |
| Assembly | cream, amber step circles |
| **Metrics** | **solid jade — beat 1** |
| Testimonials | cream, amber stars |
| **Guarantee** | **solid ink — beat 2** |
| FAQ | cream |
| Final CTA | kraft |
| Footer | cream |

Two strong full-bleed beats, separated by Testimonials, on a warm cream ground.

---

## 6. Rules that are easy to break by accident

- **The page is light-mode-locked on purpose** (`globals.css`, `app/layout.tsx`).
  Do not add `dark:` variants.
- **Prefer solid tokens over alpha.** `bg-x/40` makes contrast depend on whatever
  sits behind it, which makes an audit unverifiable. `kraft-wash`, `mist`,
  `jade-tint` and `salmon-soft` exist so that opacity is not needed.
- **`.corrugation` on a saturated surface needs `.corrugation-quiet`.** The kraft
  stripe is near-invisible on pale surfaces but reads as hard stripes on solid
  jade. `.corrugation-quiet` retints the line toward the surface's own light.
- **`themeColor` in `app/layout.tsx` is a manual mirror of `--color-cream`.**
  Metadata cannot read CSS custom properties. Update both together.
- **Focus and invalid must stay visually distinct.** Focus is `jade-ink`, invalid
  is `error`. They were once the same colour and the form could not tell them apart.

---

## 7. History

An earlier plan, `implementation_update_colors.md`, was removed when this file
replaced it. Its values never matched what actually shipped (cream, kraft, salmon
and salmon-hover all differed, and its `--color-teal-accent` was never added), and
it specified the mint `#D4F0E7` that this system replaced. It is recoverable from
git history if anyone needs it. **This file is the only current colour spec.**

`public/wondercraft_logo_svg.svg` is on disk but unreferenced, and is **not** a
brand-true asset: its fills are the pre-refinement logo colours, it includes
`#87CEEB` sky blue which is not in the palette at all, and its wordmark is live
`<text>` in Nunito, a font this site does not load. Do not swap it in for the
raster logo without first recolouring the fills and converting the text to
outlines. It is kept because it is the artwork the palette was derived from.
