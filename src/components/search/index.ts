import { css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { fetchLocations, type EmbedLocation } from "../../runtime/api";
import { resolveTenantSlug } from "../../runtime/tenant";
import { EmbedElement } from "../base";

const searchStyles = css`
  form {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
    align-items: end;
    padding: 16px;
    background: var(--fhq-color-surface);
    border: 1px solid var(--fhq-color-border);
    border-radius: var(--fhq-radius);
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
    color: var(--fhq-color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }
  input, select {
    padding: 10px 12px;
    border-radius: calc(var(--fhq-radius) - 4px);
    border: 1px solid var(--fhq-color-border);
    font-size: 14px;
    font-family: inherit;
    color: var(--fhq-color-text);
    background: var(--fhq-color-surface);
    min-height: 40px;
  }
  input:focus, select:focus {
    outline: 2px solid var(--fhq-color-secondary);
    outline-offset: 1px;
  }
  .actions { display: flex; align-items: flex-end; }
  .actions button {
    width: 100%;
    min-height: 40px;
  }
  .error { grid-column: 1 / -1; color: #b91c1c; font-size: 13px; }
`;

const isoLocalToday = (offsetDays = 0): string => {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}T10:00`;
};

@customElement("fleethq-search")
export class FleetHQSearch extends EmbedElement {
  static styles = [...EmbedElement.styles, searchStyles];

  @property({ type: String, attribute: "redirect-to" }) redirectTo: string | null = null;
  @property({ type: Boolean, attribute: "no-redirect" }) noRedirect = false;
  @property({ type: String, attribute: "submit-label" }) submitLabel = "Search vehicles";

  @state() private locations: EmbedLocation[] = [];
  @state() private locationsError: string | null = null;
  @state() private pickup: string = isoLocalToday(1);
  @state() private dropoff: string = isoLocalToday(3);
  @state() private locationId: string = "";

  connectedCallback(): void {
    super.connectedCallback();
    this.loadLocations();
  }

  private async loadLocations(): Promise<void> {
    try {
      const slug = resolveTenantSlug(this.tenant);
      const result = await fetchLocations(slug);
      this.locations = result.results || [];
    } catch (err) {
      this.locationsError = err instanceof Error ? err.message : String(err);
    }
  }

  private onSubmit(e: Event): void {
    e.preventDefault();
    const detail = {
      pickup: this.pickup,
      dropoff: this.dropoff,
      locationId: this.locationId ? Number(this.locationId) : null,
    };
    this.emitEvent("fleethq:search", detail);
    if (this.noRedirect) return;

    // ``redirect-to`` is used verbatim so partners on Webflow / Wix /
    // etc. can point search submissions at their own fleets page
    // ("https://www.rentel.io/book-now"). Only when no override is
    // supplied do we fall back to ``<checkout_base_url>/browse`` — the
    // shared hosted catalog on FleetHQ's customer-central deployment.
    let url: URL;
    if (this.redirectTo) {
      url = new URL(this.redirectTo, window.location.href);
    } else {
      const base = this.config?.checkout_base_url || "";
      if (!base) return;
      url = new URL(`${base.replace(/\/$/, "")}/browse`);
    }
    url.searchParams.set("pickup", detail.pickup);
    url.searchParams.set("dropoff", detail.dropoff);
    if (detail.locationId) url.searchParams.set("location", String(detail.locationId));
    url.searchParams.set("utm_source", "fleethq_embed");
    url.searchParams.set("utm_medium", "widget");
    window.location.href = url.toString();
  }

  render() {
    if (this.configError) return html`<div class="error">${this.configError}</div>`;
    return html`
      <form part="form" @submit=${this.onSubmit}>
        <label>
          Pickup
          <input
            type="datetime-local"
            .value=${this.pickup}
            @change=${(e: Event) => (this.pickup = (e.target as HTMLInputElement).value)}
            required
          />
        </label>
        <label>
          Drop-off
          <input
            type="datetime-local"
            .value=${this.dropoff}
            @change=${(e: Event) => (this.dropoff = (e.target as HTMLInputElement).value)}
            required
          />
        </label>
        <label>
          Location
          <select
            .value=${this.locationId}
            @change=${(e: Event) => (this.locationId = (e.target as HTMLSelectElement).value)}
          >
            <option value="">Any location</option>
            ${this.locations.map(
              (loc) => html`<option value=${loc.id}>${loc.name}${loc.address ? ` — ${loc.address}` : ""}</option>`,
            )}
          </select>
        </label>
        <div class="actions">
          <button class="fhq-button" type="submit">${this.submitLabel}</button>
        </div>
        ${this.locationsError ? html`<div class="error">${this.locationsError}</div>` : nothing}
      </form>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "fleethq-search": FleetHQSearch;
  }
}
