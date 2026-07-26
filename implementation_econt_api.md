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

## 2. Assumptions (flip any of these before implementation starts)

| # | Assumption | Why | Cost to change |
| - | ---------- | --- | -------------- |
| A1 | **Custom UI** on the Nomenclatures API, not Econt's iframe widget | The site has a strong cardboard/kraft design system; an embedded Econt iframe would look pasted in and can't be restyled | Low if decided now, high after the UI is built |
| A2 | **Office + Econtomat** delivery, address delivery deferred | Office pickup is the dominant BG e-commerce flow and needs one-third the form fields | Medium — adds streets/quarters endpoints and 4 fields |
| A3 | **Shipping price shown live** via `createLabel` in calculate mode | Makes the prototype feel real; it's one extra endpoint | Low |
| A4 | **Submit stays fake** — no shipment is created in Econt's demo system | It's a front-end prototype; writing waybills to a shared sandbox is noise | Low |
| A5 | Bulgaria only (`countryCode: "BGR"`), UI in Bulgarian | Matches the existing site | Low |

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
`{ id, code, name, address, isAPS, workingHours, lat, lon }`. The `isAPS` flag is what
separates a real office from an Econtomat locker — surface it, don't hide it, since a
locker has a parcel size limit a wardrobe-sized cardboard house will fail.

**`app/api/econt/shipping-price/route.ts`** *(only if A3 holds)*
Wraps `Shipments/LabelService.createLabel.json` with `mode: "calculate"`. This mode
computes a price and returns it **without creating a shipment** — it's the safe,
read-only way to quote. Body needs sender (your warehouse), receiver (the chosen
office), and parcel weight/dimensions.

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

**`components/site/econt-picker.tsx`** — a client component, three controls:

1. **Delivery type** — a two-way toggle: *До офис на Еконт* / *До Еконтомат*.
   Styled as the existing bordered pill pair, not a `<select>`.
2. **City** — a searchable combobox. 1,500 entries is far too many for a native
   `<select>`, and Bulgarian users type Latin ("Sofia") as often as Cyrillic
   ("София"), so filter against both `name` and `nameEn`.
3. **Office** — appears only once a city is chosen. Each row shows the office name,
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

If A3 holds, an order summary line appears under the picker once an office is chosen:
model price + delivery price + total, using the comma-decimal / symbol-after-number
convention `lib/data/pricing.ts` already documents. Prices stay in `lib/data/pricing.ts`
— that file's "never hardcode a price in a component" rule applies to shipping too.

### 3.4 Submit

Per A4, `handleSubmit` keeps showing the fake success screen. The only change: the
selected office object is included in the assembled payload and `console.log`ed, so you
can confirm in DevTools that a real Econt office id is being captured. That log is a
prototype affordance and should carry a comment saying so.

---

## 4. Build order

Each step is independently verifiable — don't start the next until the current one is
green in a browser.

1. **Credential check** (step 0). ~5 min. Capture a real response body to a scratch file.
2. **`lib/econt/client.ts` + `/api/econt/cities`.** Verify by visiting
   `localhost:3000/api/econt/cities` directly. No UI yet.
3. **`/api/econt/offices`.** Same — hit it with `?cityId=` for Sofia and eyeball it.
4. **Types**, written from the captured responses.
5. **Picker component**, wired to the two routes. Drop it on a scratch page before
   putting it in the modal — debugging a combobox inside a focus trap is worse.
6. **Modal integration** + validation.
7. **Shipping price** (A3), last, because it's the only piece that's decorative if it
   fails.
8. **Mobile pass** at 375px, plus keyboard-only run-through.

Steps 1–4 are half a day. Step 5 is the bulk of the work — a searchable combobox with
proper keyboard support is where the time actually goes, not the API.

---

## 5. Things that will bite

- **CORS**, if anyone is tempted to call Econt directly from a component. It won't work.
  See §1.
- **Payload size.** `getOffices` for all of Bulgaria is multiple megabytes. Filter and
  slim server-side, cache aggressively. Never send the raw response to the browser.
- **Cyrillic vs Latin search.** Match both `name` and `nameEn` or users typing "Sofia"
  get nothing.
- **Econtomat size limits.** Lockers can't take large parcels. If the product doesn't
  fit, either drop the Econtomat option or show a size caveat — a prototype that lets
  someone pick an impossible delivery method teaches the wrong thing in a demo.
- **Demo data is not production data.** Office ids, names and prices from
  `demo.econt.com` are broadly realistic but not authoritative. Don't screenshot demo
  prices into anything customer-facing.
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

## 7. Open questions

Answer these and the plan above collapses to a single unambiguous path. Until then,
the assumptions in §2 stand.

1. **Address delivery** (до адрес) — needed in the prototype, or is office + Econtomat
   enough? Adds `getStreets`/`getQuarters` and roughly four form fields.
2. **Parcel weight and dimensions** — required for a real price quote (A3). What does a
   packed cardboard house weigh and measure? Without this, shipping price has to be a
   hardcoded estimate.
3. **Sender city/office** — the price depends on origin. Which city ships from?
4. **Cash on delivery** — should the prototype model наложен платеж? It changes the
   quoted total (COD carries its own fee) and adds a payment-method control.
5. **The Econt widget** — confirmed not wanted? It's faster to ship and always current,
   at the cost of an iframe that will not match this site's design.
