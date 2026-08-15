# Legal & company details — to fill in before going live

The legal pages and the footer are written and wired up, but every
company-specific fact is a **placeholder**. Placeholders render literally on the
page as `[ПОПЪЛНИ: …]`, so an unfilled value is impossible to miss.

myPOS reviews the website when approving an online store, and Bulgarian /
EU distance-selling rules require these details to be published. Filling these
in is a business step, not a code change.

## One file to edit

Everything lives in **`lib/data/company.ts`**. Replace each placeholder string
with the real value and every page and the footer update at once.

| Field | What it needs | Appears on |
|---|---|---|
| `legalName` | Registered company name, e.g. `„Уондъркрафт“ ЕООД` | footer, /terms, /privacy |
| `eik` | EIK (company registration number) | footer, /terms, /privacy |
| `vatNumber` | VAT number, or the words for "not VAT registered" | /terms |
| `address` | Registered address of management | footer, /terms, /privacy |
| `email` | Customer support email | footer, all three legal pages |
| `phone` | Customer support phone | footer, /terms, /delivery-returns |
| `returnsAddress` | Where customers send returns — often not the registered address | /delivery-returns |
| `courier` | Courier name, e.g. `Еконт` or `Спиди` | /terms, /privacy, /delivery-returns |
| `deliveryTime` | Realistic delivery window, e.g. `2–4 работни дни` | /terms, /delivery-returns |

`deliveryCost` currently reads "free delivery for all orders", matching the
agreed all-in pricing. Change it if that ever stops being true.

The consumer-protection authority details (`authorities.kzp`, `authorities.cpdp`)
are fixed Bulgarian values and need no editing.

## Also outstanding, unrelated to payments

- **`lib/data/faq.ts`** still contains `TODO: заменете с реалните размери` — the
  assembled dimensions of the house are `XX × XX × XX см`.
- **`lib/data/testimonials.ts`** is marked in its own comments as **fictional,
  not for publication**. Publishing invented testimonials alongside a real
  checkout is a consumer-protection problem, so either replace them with real
  quotes or remove the section before launch.

## Review the wording

The legal text is a reasonable, plain-Bulgarian starting point covering the
usual ground: parties, prices, order formation, card payment via myPOS, the
14-day right of withdrawal, the custom-goods exemption for personalised houses,
warranty, data protection and complaints. **It has not been reviewed by a
lawyer.** Before launch, have someone qualified read `/terms`, `/privacy` and
`/delivery-returns` — particularly the custom-goods exemption, since that is the
clause most likely to be challenged.
