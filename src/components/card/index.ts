import { css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { fetchFleetDetail } from "../../runtime/api";
import { buildBookingUrl } from "../../runtime/booking-url";
import { openCheckoutOverlay } from "../../runtime/checkout";
import { resolveTenantSlug } from "../../runtime/tenant";
import { formatCurrency } from "../../runtime/theme";
import type { FleetDetail, FleetSummary } from "../../runtime/types";
import { EmbedElement } from "../base";

const cardStyles = css`
  .card {
    display: flex;
    flex-direction: column;
    background: var(--fhq-color-surface);
    border: 1px solid var(--fhq-color-border);
    border-radius: var(--fhq-radius);
    overflow: hidden;
    height: 100%;
  }
  .card__media {
    aspect-ratio: 16 / 10;
    background: var(--fhq-color-surface-alt);
    position: relative;
    overflow: hidden;
  }
  .card__media img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .card__badge {
    position: absolute;
    top: 12px;
    left: 12px;
    background: rgba(15, 23, 42, 0.85);
    color: #fff;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .card__body {
    padding: 14px 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .card__title {
    font-size: 16px;
    font-weight: 600;
    line-height: 1.3;
    margin: 0;
    color: var(--fhq-color-text);
  }
  .card__meta {
    color: var(--fhq-color-text-muted);
    font-size: 13px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .card__meta span::after { content: "·"; margin-left: 8px; opacity: 0.6; }
  .card__meta span:last-child::after { content: ""; margin-left: 0; }
  .card__price {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-top: 4px;
  }
  .card__price-value { font-size: 18px; font-weight: 700; color: var(--fhq-color-text); }
  .card__price-unit { font-size: 13px; color: var(--fhq-color-text-muted); }
  .card__footer {
    display: flex;
    justify-content: flex-end;
    padding: 0 16px 16px;
  }
  .card__skeleton {
    background: linear-gradient(90deg, #eee 25%, #f5f5f5 37%, #eee 63%);
    background-size: 400% 100%;
    animation: fhq-skeleton 1.4s ease infinite;
  }
  @keyframes fhq-skeleton {
    0% { background-position: 100% 50%; }
    100% { background-position: 0 50%; }
  }
  .card__error {
    padding: 16px;
    color: #b91c1c;
    font-size: 13px;
  }
`;

@customElement("fleethq-vehicle-card")
export class FleetHQVehicleCard extends EmbedElement {
  static styles = [...EmbedElement.styles, cardStyles];

  @property({ type: Number, attribute: "fleet-id" }) fleetId: number | null = null;
  @property({ type: Object }) fleet: FleetSummary | FleetDetail | null = null;
  @property({ type: String, attribute: "cta-label" }) ctaLabel = "Book now";
  @property({ type: String, attribute: "checkout-target" }) checkoutTarget: "redirect" | "iframe" = "redirect";
  @property({ type: String, attribute: "pickup" }) pickup: string | null = null;
  @property({ type: String, attribute: "dropoff" }) dropoff: string | null = null;

  @state() private fetching = false;
  @state() private fetchError: string | null = null;
  @state() private detail: FleetDetail | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    if (!this.fleet && this.fleetId) this.loadDetail();
  }

  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null): void {
    super.attributeChangedCallback(name, oldVal, newVal);
    if (name === "fleet-id" && !this.fleet && this.fleetId) this.loadDetail();
  }

  private async loadDetail(): Promise<void> {
    if (!this.fleetId) return;
    this.fetching = true;
    this.fetchError = null;
    try {
      const slug = resolveTenantSlug(this.tenant);
      this.detail = await fetchFleetDetail(slug, this.fleetId);
    } catch (err) {
      this.fetchError = err instanceof Error ? err.message : String(err);
    } finally {
      this.fetching = false;
    }
  }

  private get resolvedFleet(): FleetSummary | FleetDetail | null {
    return this.fleet || this.detail;
  }

  private async handleBook(event: Event): Promise<void> {
    event.preventDefault();
    const fleet = this.resolvedFleet;
    if (!fleet) return;
    const url = await buildBookingUrl({
      fleetId: fleet.id,
      pickup: this.pickup || undefined,
      dropoff: this.dropoff || undefined,
      tenant: this.tenant || undefined,
    });
    this.emitEvent("fleethq:book", { fleet, url, target: this.checkoutTarget });
    if (this.checkoutTarget === "iframe") {
      const result = await openCheckoutOverlay({ url, tenant: this.tenant });
      this.emitEvent("fleethq:checkout-result", { fleet, ...result });
      return;
    }
    window.location.href = url;
  }

  render() {
    if (this.configError) return html`<div class="card"><div class="card__error">${this.configError}</div></div>`;
    if (this.fetchError) return html`<div class="card"><div class="card__error">${this.fetchError}</div></div>`;
    if (this.loading || this.fetching || !this.resolvedFleet) return this.renderSkeleton();

    const fleet = this.resolvedFleet;
    const currency = this.config?.currency || "USD";
    const meta = [
      `${fleet.seats} seats`,
      `${fleet.doors} doors`,
      fleet.transmission || null,
      fleet.fuel_type || null,
    ].filter((entry): entry is string => Boolean(entry));

    return html`
      <article class="card" part="card">
        <div class="card__media">
          ${fleet.hero_image
            ? html`<img src=${fleet.hero_image} alt=${fleet.name} loading="lazy" />`
            : nothing}
          ${fleet.fleet_class ? html`<span class="card__badge">${fleet.fleet_class.name}</span>` : nothing}
        </div>
        <div class="card__body">
          <h3 class="card__title">${fleet.year} ${fleet.make} ${fleet.model}</h3>
          <div class="card__meta">${meta.map((entry) => html`<span>${entry}</span>`)}</div>
          <div class="card__price">
            ${fleet.price_per_day
              ? html`
                  <span class="card__price-value">${formatCurrency(fleet.price_per_day, currency)}</span>
                  <span class="card__price-unit">/ day</span>
                `
              : fleet.price_per_hour
                ? html`
                    <span class="card__price-value">${formatCurrency(fleet.price_per_hour, currency)}</span>
                    <span class="card__price-unit">/ hour</span>
                  `
                : html`<span class="card__price-unit">Contact for rates</span>`}
          </div>
        </div>
        <div class="card__footer">
          <button class="fhq-button" type="button" @click=${this.handleBook}>${this.ctaLabel}</button>
        </div>
      </article>
    `;
  }

  private renderSkeleton() {
    return html`
      <article class="card" aria-busy="true">
        <div class="card__media card__skeleton"></div>
        <div class="card__body">
          <div class="card__skeleton" style="height:16px;border-radius:6px;width:70%"></div>
          <div class="card__skeleton" style="height:12px;border-radius:6px;width:50%"></div>
          <div class="card__skeleton" style="height:18px;border-radius:6px;width:35%;margin-top:6px"></div>
        </div>
        <div class="card__footer">
          <div class="card__skeleton" style="height:36px;border-radius:8px;width:110px"></div>
        </div>
      </article>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "fleethq-vehicle-card": FleetHQVehicleCard;
  }
}
