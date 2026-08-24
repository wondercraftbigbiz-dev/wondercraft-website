# Wondercraft website

Bulgarian single-page DTC site for a recycled-cardboard children's playhouse.
All copy is Bulgarian; do not translate or rewrite it without being asked.

## Stack

- Next.js 16 App Router, React 19, TypeScript. One page: `app/page.tsx`.
- **Tailwind v4, CSS-first.** There is no `tailwind.config.*`. The whole theme
  lives in the `@theme inline` block of `app/globals.css`; Tailwind generates
  utilities from the `--color-*` names there.
- **Light-mode-locked on purpose.** Do not add `dark:` variants.
- `components/ui/button.tsx` is dead code (zero imports) and references shadcn
  tokens that do not exist in the theme. Do not import it.
- Checks: `pnpm typecheck`, `pnpm build`. There is no ESLint config in the repo,
  so `pnpm lint` fails on a missing `eslint.config.js` — that is pre-existing.

## Colour

**Read `DESIGN.md` before changing any colour.** It carries the token table,
contrast ratios, and the banned pairs.

The eight official brand colours, derived from the logo:

| Name | Hex | Role |
|---|---|---|
| Amber | `#FEC86E` | highlight |
| Ink | `#2C2925` | warm near-black |
| Lavender | `#BBA8E3` | reserved, unused on this surface |
| Jade | `#70C3A4` | affirm / calm |
| Salmon | `#FAA297` | commit / action |
| Stone | `#736F6D` | warm grey |
| Mist | `#E8E4E1` | neutral surface |
| Sand | `#F6CD92` | cardboard warmth |

The rule that holds the page together:

> **Salmon commits** (only what the visitor clicks to buy or submit).
> **Amber highlights** (featured, rated, guaranteed, sequenced).
> **Jade affirms** (included, confirmed, growing, secondary navigation).

Accents at their brand value are too light for text. Use `jade-ink #2F7357` for
coloured text and `error #B0453A` for errors; never `salmon` or `amber` as body copy.
