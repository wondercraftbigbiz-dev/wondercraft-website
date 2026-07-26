# Econt API integration — implementation plan (demo/test only)

Goal: let a visitor pick an Econt office (or address) inside the existing "Поръчай сега"
modal, using Econt's **demo** environment. No real shipments, no production credentials.

Status: plan only. No code written yet.

---

## 0. Verify access before building

The demo environment uses HTTP Basic auth against a shared sandbox account.

```
Base URL:  https://demo.econt.com/ee/services
Auth:      Basic, user "iasp-dev", password "iasp-dev"
Transport: POST, Content-Type: application/json, JSON body (never GET)
```

Two spellings of the demo password circulate in Econt's docs and third-party SDKs
(`iasp-dev` and `1Asp-dev`). Confirm which one works with a single call before writing
anything else:

```bash
curl -s -u 'iasp-dev:iasp-dev' \
  -H 'Content-Type: application/json' \
  -d '{"countryCode":"BGR"}' \
  https://demo.econt.com/ee/services/Nomenclatures/NomenclaturesService.getCities.json | head -c 400
```

A JSON body with a `cities` array means you're in. A 401 means try the other password.
If both fail, request a demo account from Econt (integration@econt.com) — the shared
sandbox is occasionally rotated.

**Do not skip this.** Everything below assumes a working credential, and debugging a
proxy route against a dead credential is the most likely way to lose an afternoon.

---

## 1. The one architectural constraint that shapes everything

**Econt's API sends no CORS headers.** A `fetch()` from the browser to `demo.econt.com`
will be blocked by the browser, every time, regardless of what you send. It also means
the Basic-auth credential cannot live in client code — even demo credentials shouldn't
ship in a JS bundle that gets indexed.

So: **all Econt calls go through Next.js Route Handlers** in `app/api/econt/*`. The
browser talks only to your own origin. This is not optional and it is not a "nice to
have for later" — it is the reason the integration has a server layer at all, in a
project that currently has none.

This is the first server-side code in the repo. It stays deliberately thin: proxy,
normalise, cache. No database, no order persistence, no business logic.

```
Browser (client component)
   │  fetch('/api/econt/offices?cityId=41')
   ▼
Next.js Route Handler  ── injects Basic auth, caches ──►  demo.econt.com/ee/services
   │  normalised, slimmed JSON
   ▼
Browser renders the picker
```

---

## 2. Decisions (confirmed)

| # | Decision | Notes |
| - | -------- | ----- |
| D1 | **Custom UI** on the Nomenclatures API. No Econt iframe widget. | Confirmed. The picker is built in the site's own cardboard design system. |
| D2 | **Office delivery to every Econt office in Bulgaria.** No address delivery. | `getStreets`/`getQuarters` are out of scope. See §2.1 on Econtomat lockers. |
| D3 | **Shipping price shown live** via `createLabel` in `calculate` mode. | Uses the placeholder parcel spec in §2.2. |
| D4 | **Online payment only. No cash on delivery.** | No наложен платеж fee in the quote, no payment-method control, no COD fields on the label call. See §2.3. |
| D5 | **Submit stays fake** — no shipment is created in Econt's demo system. | Selection is captured and logged only. |
| D6 | **Sender: Blagoevgrad.** | Origin for all price calculations. |
| D7 | Bulgaria only (`countryCode: "BGR"`), UI in Bulgarian. | Matches the existing site. |

### 2.1 Econtomat lockers

D2 says "every Econt office in Bulgaria". `getOffices` returns both staffed offices and
Econtomat lockers in one list, distinguished by the `isAPS` flag. Lockers have a parcel
size limit that a flat-packed playhouse will likely exceed.

**Plan: filter `isAPS === true` out of the list.** A locker the product cannot physically
fit into isn't an office worth offering, and a demo that lets someone choose an
impossible delivery method teaches the wrong thing. This is one line in the offices
route and trivially reversible once real box dimensions exist (§2.2) — if the packed
house turns out to fit a locker, drop the filter and add the delivery-type toggle back.

### 2.2 Parcel spec — placeholder values

Real weight and dimensions aren't known yet, so these are stand-ins chosen to be
plausible for a flat-packed corrugated playhouse:

```
weight:  5 kg
size:    80 × 60 × 15 cm  (flat-packed)
```

These live in **one exported constant** in `lib/econt/config.ts`, commented as
placeholders, so correcting them later is a one-line edit rather than a hunt. They are
the only fabricated numbers in the integration.

Consequence worth stating plainly: **the shipping prices this prototype displays are not
real.** They are correctly-computed Econt quotes for a parcel that may not match the
actual product. Fine for testing the flow and the UI; not fine for a screenshot that
reaches a customer.

### 2.3 What "online payment only" does and doesn't mean

No COD removes the наложен платеж fee from the quote and drops the payment-method
control from the modal — the shipping quote is simply the courier tariff.

It does **not** mean a payment integration. This is still a front-end prototype with a
fake success screen (D5); there is no Stripe, no card form, no payment provider. The
modal should say that delivery is prepaid without implying a checkout exists. When a
real payment provider is added later, it sits alongside this work and doesn't change
the Econt layer.

---

## 3. What gets built

### 3.1 Server layer — `app/api/econt/`

Four route handlers, all thin wrappers over one shared client.

**`lib/econt/client.ts`** — the only place that knows the base URL and credentials.
One function, `callEcont(service, method, body)`, that POSTs, attaches Basic auth from
env vars, throws a typed error on non-2xx, and returns parsed JSON. Everything else
calls through it.

**`app/api/econt/cities/route.ts`**
Wraps `Nomenclatures/NomenclaturesService.getCities.json` with `{"countryCode":"BGR"}`.
Returns ~1,500 Bulgarian cities. Slim each entry down to what the picker needs:
`{ id, name, nameEn, postCode, regionName }` — the raw payload carries coordinates,
municipality objects and expansion flags you'll never render, and dropping them cuts
the response by roughly 70%.

**`app/api/econt/offices/route.ts`**
Wraps `getOffices.json`. Accepts `?cityId=` and filters server-side. Slim to
`{ id, code, name, address, workingHours, lat, lon }`. Per §2.1, entries with
`isAPS === true` (Econtomat lockers) are dropped here — the flag is read and used, but
never reaches the client.

**`app/api/econt/shipping-price/route.ts`**
Wraps `Shipments/LabelService.createLabel.json` with `mode: "calculate"`. This mode
computes a price and returns it **without creating a shipment** — the safe, read-only
way to quote. Body carries sender (Blagoevgrad, D6), receiver (the chosen office), and
the parcel spec from §2.2. No COD fields (D4).

**Caching.** The city and office nomenclatures change maybe monthly. Fetching several
megabytes on every modal open is wasteful and slow. Use Next's built-in fetch cache
with `next: { revalidate: 86400 }` — one line, no extra dependency, survives across
requests. Cities can additionally be pre-fetched at build time.

**Environment variables** — `.env.local`, never committed, no `NEXT_PUBLIC_` prefix
(that prefix inlines the value into the client bundle, which is exactly what must not
happen here):

```
ECONT_API_URL=https://demo.econt.com/ee/services
ECONT_USERNAME=iasp-dev
ECONT_PASSWORD=iasp-dev
```

Add a committed `.env.example` documenting the three names with empty values, so the
next person knows what's needed.

### 3.2 Client layer — the picker

**`lib/econt/types.ts`** — TypeScript types for the slimmed shapes. Written by hand
from one real response captured during step 0, not guessed from docs. Econt's actual
JSON differs from its documentation in small ways (nullable fields mostly), and a
captured response is the honest source.

**`components/site/econt-picker.tsx`** — a client component, two controls (no
delivery-type toggle: offices only, per D2):

1. **City** — a searchable combobox. 1,500 entries is far too many for a native
   `<select>`, and Bulgarian users type Latin ("Sofia") as often as Cyrillic
   ("София"), so filter against both `name` and `nameEn`.
2. **Office** — appears only once a city is chosen. Each row shows the office name,
   full address and working hours. Disabled with a hint until a city is picked, rather
   than hidden — a control that appears from nowhere is more disorienting than one
   that's visibly waiting.

Behaviour worth getting right: debounce the city search input by ~200ms; show a
skeleton row, not a spinner, while offices load; keep full keyboard navigation
(arrow keys, Enter, Escape) since this lives inside a focus-trapped modal that already
handles Tab cycling.

**Design fit.** Reuse the existing `.modal-input` class, `border-2 border-charcoal`,
`rounded-[8px]`, salmon for the selected state. The dropdown panel should read as a
cardboard card — kraft background, charcoal border — not as a default browser listbox.
No new UI dependency; a combobox at this scale is ~80 lines against `@base-ui/react`,
which is already a dependency.

### 3.3 Modal integration — `components/site/contact-modal.tsx`

The current modal has a single free-text field:

```tsx
<Field label="Град / офис на куриер" error={errors.city}>
  <input name="city" type="text" className="modal-input" />
</Field>
```

That one field is replaced by `<EcontPicker />`. Everything around it — the focus trap,
the Escape handler, the body-scroll lock, the success state, the `Field` wrapper — stays
untouched. The modal grows taller, so verify the `max-h-[70vh] overflow-y-auto` form
body still scrolls cleanly on a 375px-wide viewport with the office dropdown open;
that combination is where this will break if it breaks anywhere.

Validation extends the existing `Errors` type: replace `city` with `office`, message
`"Моля, изберете офис на Еконт."`, applying the same "validate on submit, not on blur"
pattern the modal already uses.

An order summary line appears under the picker once an office is chosen: model price +
delivery price + total, using the comma-decimal / symbol-after-number convention
`lib/data/pricing.ts` already documents. Prices stay in `lib/data/pricing.ts` — that
file's "never hardcode a price in a component" rule applies to shipping too. Since
delivery is prepaid (D4), the total is the full amount, with no COD line.

### 3.4 Submit

Per D5, `handleSubmit` keeps showing the fake success screen. The only change: the
selected office object is included in the assembled payload and `console.log`ed, so you
can confirm in DevTools that a real Econt office id is being captured. That log is a
prototype affordance and should carry a comment saying so.

---

## 4. Build checklist

- [ ] 1. **Credential check** (§0) — confirm which demo password works, capture a real
      response body. *Blocked in the build sandbox: `demo.econt.com` is unreachable from
      it (curl exit 56). Must be run on a machine with open network.*
- [x] 2. **`lib/econt/config.ts` + `lib/econt/client.ts` + `/api/econt/cities`.**
- [x] 3. **`/api/econt/offices`.**
- [x] 4. **`lib/econt/types.ts`.** Written from Econt's published shapes rather than a
      captured response, since step 1 is blocked — see §8.
- [x] 5. **Picker component** (`components/site/econt-picker.tsx`), wired to both routes.
- [x] 6. **Modal integration** + validation.
- [x] 7. **Shipping price** (`/api/econt/shipping-price` + summary line).
- [x] 8. **Checks** — TypeScript, production build, and a 13-assertion browser pass
      against mocked API responses. See §8.
- [ ] 9. **Live pass** — real Econt responses. Requires step 1; see §8.2.

---

## 5. Things that will bite

- **CORS**, if anyone is tempted to call Econt directly from a component. It won't work.
  See §1.
- **Payload size.** `getOffices` for all of Bulgaria is multiple megabytes. Filter and
  slim server-side, cache aggressively. Never send the raw response to the browser.
- **Cyrillic vs Latin search.** Match both `name` and `nameEn` or users typing "Sofia"
  get nothing.
- **Demo data is not production data.** Office ids, names and prices from
  `demo.econt.com` are broadly realistic but not authoritative.
- **Displayed shipping prices are doubly unreal** — a demo-environment tariff applied to
  a placeholder parcel spec (§2.2). Don't put them in front of a customer.
- **The shared sandbox can be slow or briefly down.** Every route needs a real error
  path: a Bulgarian-language message and a retry, not a blank dropdown.

---

## 6. Path to production (not now, but worth knowing)

The demo→production switch is intended to be a config change: swap `ECONT_API_URL` to
`https://ee.econt.com/services` and use the credentials issued with a real Econt client
contract. Two things that don't come for free — an actual shipment-creating call
(`createLabel` without `mode: "calculate"`), and somewhere to persist orders, since a
front-end-only prototype has no order store. Keeping all Econt access behind
`lib/econt/client.ts` is what makes that later change small.

---

## 7. Loose ends

No blocking questions remain — §2 is settled and implementation can start. Two items to
revisit when the information exists:

1. **Real parcel weight and dimensions**, replacing the placeholders in §2.2. Until then
   the quoted shipping prices are indicative only.
2. **Econtomat lockers**, currently filtered out (§2.1). If the flat-packed box turns out
   to fit locker limits, drop the filter and add a delivery-type toggle to the picker.

---

## 8. What was verified, and what wasn't

### 8.1 Verified

TypeScript and `next build` pass, and all three routes register as dynamic. Input
validation and the error paths were exercised against the live route handlers
(`400` on a missing `cityId`, `400` on a missing `officeCode`, upstream failure
surfaced with a Bulgarian message and the technical detail logged server-side only).

The picker was driven in a real browser at 375px with the API responses mocked —
13 assertions, all passing: Latin query matching a Cyrillic city, offices loading after
city selection, submit blocked without an office, the error clearing on selection,
the quote and total arithmetic, Escape scoping, city change clearing a stale office,
no horizontal overflow, and the success state. No runtime console errors.

That pass found two real bugs, both fixed:

- **`parseLev` returned `NaN` for every price.** Stripping non-numeric characters from
  `"58,67 лв."` leaves the trailing period of "лв." behind, giving `"58.67."`. The
  total silently fell back to the item price with delivery omitted — the summary
  showed a plausible wrong number rather than failing visibly. Now matches the numeric
  substring explicitly.
- **Escape in the city dropdown closed the entire modal.** React attaches synthetic
  handlers to the root container, which is below `document`, so `stopPropagation()`
  from an `onKeyDown` prop could not stop the modal's document-level Escape listener.
  Dismissing the dropdown wiped every field the user had filled in. Now intercepted by
  a capture-phase listener on `document`, which runs first.

### 8.2 Not verified — needs a machine with network access

Everything touching Econt's actual responses. The build sandbox cannot reach
`demo.econt.com`, so the request and response shapes come from Econt's documentation.

In rough order of likelihood to need adjustment:

1. **Credentials** — which demo password works (§0).
2. **`getOffices` parameter name.** Sent as `cityID` (capital ID) per the docs. If
   offices come back empty for a valid city, try `cityId`.
3. **The price quote.** The most fragile piece — `createLabel` validates the sender
   address, and the Blagoevgrad street in `lib/econt/config.ts` is a placeholder. If it
   is rejected, switch `senderAddress` for a `senderOfficeCode` taken from
   `/api/econt/offices?cityId=<Blagoevgrad>`. A failed quote degrades to
   "по тарифа на Еконт" rather than breaking the flow, so this can be fixed after the
   rest is confirmed working.
4. **Field nullability** in `RawOffice` / `RawCity` — read defensively throughout, but
   worth confirming that office names and addresses actually populate.
5. **Working hours format.** Handled as both `"09:00"` strings and seconds-from-midnight
   numbers, since Econt's docs disagree with each other; whichever arrives, unparseable
   values are dropped rather than rendered wrong.

To run the live pass:

```bash
cp .env.example .env.local   # fill in the working credentials
npm run dev
curl localhost:3000/api/econt/cities | head -c 400
curl 'localhost:3000/api/econt/offices?cityId=41' | head -c 400
```

Then open the order modal and pick a real Sofia office. Server-side errors are logged
with the full Econt message under `[econt/*]` in the dev console; the browser only ever
sees the Bulgarian summary.
