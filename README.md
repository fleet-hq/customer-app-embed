# FleetHQ Embed

Drop-in Web Components that let any third-party website browse and book directly against a FleetHQ tenant. One `<script>` tag, one HTML element per widget, no framework required — works inside plain HTML pages, WordPress, Wix, Squarespace, Webflow, and any React / Vue / Angular / Svelte app.

- **Zero dependencies at install time.** One IIFE bundle (~11 KB gzipped). Style-isolated via Shadow DOM — no CSS bleed.
- **Tenant-scoped.** The widget resolves the tenant from the embed slug (or the host it's served from) and reads theme + branding from the FleetHQ API.
- **Checkout stays on FleetHQ.** Book buttons redirect to the tenant's hosted `customer-central` checkout, so PCI + Stripe Identity + fraud tooling never leave FleetHQ's boundary.

---

## Installation

Drop the loader once, then use any widget as an HTML element.

```html
<script
  src="https://embed.fleethq.io/v0/embed.js"
  data-fleethq-tenant="kaysgroove.com"
  defer
></script>

<fleethq-fleet-catalog></fleethq-fleet-catalog>
```

- `data-fleethq-tenant` — the tenant's public domain (or FleetHQ Company id). Every widget on the page inherits it, so you only set this once.
- `data-fleethq-api` — optional API base URL override. Defaults to `https://api.fleethq.io` in production, `http://localhost:8000` on localhost.

### React / Vue / Angular

Web Components render inside any framework. Just make sure the loader script is on the page (`<script>` tag in `index.html`, or a dynamic `<script>` in your app shell) and use the tag like any other element:

```jsx
export function VehiclePicker() {
  return <fleethq-fleet-catalog tenant="kaysgroove.com" page-size={6} />;
}
```

React < 19 needs the tag declared as an intrinsic element in a `.d.ts` file — see [`docs/react.md`](./docs/react.md).

---

## Widgets

### `<fleethq-fleet-catalog>`

Paginated grid of the tenant's available vehicles with a search input.

| Attribute      | Type                       | Default     | Notes                                                    |
| -------------- | -------------------------- | ----------- | -------------------------------------------------------- |
| `tenant`       | `string`                   | script attr | Overrides the loader's default tenant                    |
| `page-size`    | `number`                   | `12`        | 1–48                                                     |
| `pickup`       | `string` (ISO datetime)    | —           | Hides fleets with overlapping bookings                   |
| `dropoff`      | `string` (ISO datetime)    | —           | Hides fleets with overlapping bookings                   |
| `location-id`  | `number`                   | —           | Restricts to fleets available at that FleetHQ location   |
| `cta-label`    | `string`                   | `Book now`  | Card CTA copy                                            |
| `no-search`    | `boolean`                  | `false`     | Removes the search input                                 |

Events (bubble + composed):

- `fleethq:catalog-loaded` — `{ page, count, results }`
- `fleethq:book` — `{ fleet, url, target }`

### `<fleethq-vehicle-card fleet-id="123">`

Standalone card. Either supply a `fleet-id` (component fetches details) or bind an already-loaded fleet via `.fleet` (property, not attribute).

| Attribute         | Type                       | Default     | Notes |
| ----------------- | -------------------------- | ----------- | ----- |
| `tenant`          | `string`                   | script attr |       |
| `fleet-id`        | `number`                   | —           |       |
| `cta-label`       | `string`                   | `Book now`  |       |
| `pickup`          | `string` (ISO datetime)    | —           | Passed through to checkout URL |
| `dropoff`         | `string` (ISO datetime)    | —           | Passed through to checkout URL |
| `checkout-target` | `redirect` \| `iframe`     | `redirect`  | `iframe` opens in an overlay ([Iframe checkout](#iframe-checkout)) |

### `<fleethq-search>`

Pickup / drop-off / location picker. Submitting redirects to `/browse` on the tenant's hosted site by default.

| Attribute       | Type      | Default            | Notes                                              |
| --------------- | --------- | ------------------ | -------------------------------------------------- |
| `tenant`        | `string`  | script attr        |                                                    |
| `redirect-to`   | `string`  | tenant's site      | Custom URL to redirect to on submit                |
| `no-redirect`   | `boolean` | `false`            | Emit `fleethq:search` only, do not redirect       |
| `submit-label`  | `string`  | `Search vehicles`  |                                                    |

Event: `fleethq:search` — `{ pickup, dropoff, locationId }`.

### `<fleethq-book-button fleet-id="123">`

Minimal CTA. Resolves the tenant's checkout URL and redirects, opens a new tab, or opens an in-page overlay.

| Attribute         | Type                       | Default    | Notes                                                     |
| ----------------- | -------------------------- | ---------- | --------------------------------------------------------- |
| `tenant`          | `string`                   | script attr|                                                           |
| `fleet-id`        | `number`                   | required   |                                                           |
| `label`           | `string`                   | `Book now` |                                                           |
| `pickup`          | `string` (ISO datetime)    | —          |                                                           |
| `dropoff`         | `string` (ISO datetime)    | —          |                                                           |
| `location-id`     | `number`                   | —          |                                                           |
| `variant`         | `solid` \| `ghost`         | `solid`    |                                                           |
| `new-tab`         | `boolean`                  | `false`    | Ignored when `checkout-target="iframe"`                   |
| `checkout-target` | `redirect` \| `iframe`     | `redirect` | See [Iframe checkout](#iframe-checkout)                   |

Event: `fleethq:book` — `{ fleetId, url, target }`.
When `checkout-target="iframe"`: also fires `fleethq:checkout-result` — `{ fleetId, reason, bookingId?, referenceNumber? }`.

---

## Iframe checkout

Setting `checkout-target="iframe"` on `<fleethq-vehicle-card>` or `<fleethq-book-button>` opens the tenant's hosted checkout in a modal overlay on the partner's page. The customer never leaves the partner site; PCI + Stripe Identity + fraud tooling still run inside FleetHQ's own domain.

```html
<fleethq-book-button fleet-id="42" checkout-target="iframe"></fleethq-book-button>
```

Behind the scenes the widget:

1. Resolves `TenantConfig.checkout_base_url`.
2. Opens a full-page modal (`<fleethq-checkout-overlay>`) with an `<iframe>` pointed at the checkout URL with `?embed=1&embed_version=…&embed_tenant=…`.
3. Talks to the iframe via `postMessage` — origin-locked to the tenant's checkout origin.

Events on the widget (bubble + composed, cancelable via `event.stopPropagation()`):

| Event                          | Detail                                              | Fires when                                          |
| ------------------------------ | --------------------------------------------------- | --------------------------------------------------- |
| `fleethq:checkout-ready`       | `{ url }`                                           | Checkout page finishes hydrating inside the iframe  |
| `fleethq:checkout-navigate`    | `{ url }`                                           | Customer navigates within the iframe (analytics)    |
| `fleethq:checkout-complete`    | `{ bookingId, referenceNumber?, url? }`             | Booking succeeds                                    |
| `fleethq:checkout-error`       | `{ message, code? }`                                | Booking fails                                       |
| `fleethq:checkout-closed`      | `{ reason: "user" \| "success" \| "error" }`        | Overlay closes                                      |
| `fleethq:checkout-handoff`     | `{ url }`                                           | Iframe requests a top-window navigation (e.g. redirect flows) |

The overlay closes automatically on success (fires `checkout-complete` before `checkout-closed`) and on ESC or backdrop click (fires `checkout-closed` with `reason: "user"`).

### Message protocol (postMessage)

Both directions use the envelope `{ namespace: "fleethq:embed", payload: { type: …, … } }`.

From iframe → parent:

- `ready` — `{ height?, url? }`
- `resize` — `{ height }` — auto-height (min 300, max 5000)
- `navigate` — `{ url }`
- `close` — no payload
- `handoff` — `{ url }` — replace the top window
- `booking-complete` — `{ bookingId, referenceNumber?, url? }`
- `booking-error` — `{ message, code? }`

From parent → iframe:

- `hello` — `{ version, tenant }` — sent immediately after `ready`
- `close` — no payload

Origin is verified on the parent against the tenant's `checkout_base_url` before any message is trusted.

### Enabling iframe mode on `customer-central`

The customer-central app ships a drop-in bridge at [`src/lib/embed-bridge.ts`](./src/lib/embed-bridge.ts) (mirrored in this repo) plus a `useEmbedBridge()` React hook. Wire it in the checkout provider:

```tsx
import { useEmbedBridge } from "@/hooks";

export function CheckoutProvider({ children }) {
  const { embedded, reportBookingComplete, reportBookingError } = useEmbedBridge();
  return (
    <BookingContext.Provider value={{ embedded, reportBookingComplete, reportBookingError }}>
      {children}
    </BookingContext.Provider>
  );
}
```

Then, on the success page:

```tsx
useEffect(() => {
  if (booking?.id) reportBookingComplete(booking.id, { referenceNumber: booking.reference_number });
}, [booking?.id]);
```

The hook auto-sends `ready`, auto-resizes the iframe using `ResizeObserver`, and forwards popstate as `navigate` for analytics.

---

## Programmatic API

Everything on the loader is exposed via `window.FleetHQEmbed`:

```js
window.FleetHQEmbed.init({ tenant: "kaysgroove.com", apiBase: "https://api.fleethq.io" });

const config = await window.FleetHQEmbed.getConfig();
const bookingUrl = await window.FleetHQEmbed.buildBookingUrl({
  fleetId: 42,
  pickup: "2026-08-01T10:00",
  dropoff: "2026-08-03T10:00",
});
window.location.href = bookingUrl;
```

---

## Theming

Widgets read theme tokens from the tenant's FleetHQ `CompanyContent` (primary / secondary / accent / hover). Partners can override on their end via CSS custom properties on the widget host:

```css
fleethq-fleet-catalog {
  --fhq-color-primary: #0060d2;
  --fhq-color-secondary: #111827;
  --fhq-radius: 8px;
  --fhq-font-family: "Poppins", sans-serif;
}
```

All tokens exposed:

- `--fhq-color-primary`
- `--fhq-color-primary-hover`
- `--fhq-color-secondary`
- `--fhq-color-accent`
- `--fhq-color-text`
- `--fhq-color-text-muted`
- `--fhq-color-border`
- `--fhq-color-surface`
- `--fhq-color-surface-alt`
- `--fhq-radius`
- `--fhq-font-family`

---

## Local development

```bash
npm install
npm run dev       # http://localhost:4321 — sandbox playground
npm run build     # dist/embed.js — IIFE library bundle
npm run typecheck # tsc --noEmit
```

Sandbox defaults to `?tenant=faqtor.dev.fleethq.io` against `http://localhost:8000`. Point at a different backend with a `data-fleethq-api` script attribute in `sandbox/index.html`.

---

## Backend surface

All endpoints live under `/api/embed/`, permission `AllowAny`, throttled at 300/min per IP (`embed_anon` scope).

- `GET /api/embed/tenant-resolve/` — resolve tenant by `tenant=` slug or `Origin` / `Referer` host. Returns `TenantConfig`.
- `GET /api/embed/config/` — same shape as `tenant-resolve` (alias).
- `GET /api/embed/fleets/` — paginated fleet list. Params: `q`, `fleet_class`, `seats_min`, `transmission`, `location`, `pickup_datetime`, `dropoff_datetime`, `page`, `page_size`.
- `GET /api/embed/fleets/<id>/` — fleet detail.
- `GET /api/embed/locations/` — pickup / drop-off locations for the tenant.

CORS is emitted only for the tenant's registered `CompanyDomain` origins (plus `localhost` in dev). Widgets running on unregistered hosts fail their fetch — this is the guarantee that a partner site can't spoof a competitor's tenant.
