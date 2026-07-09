import { css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { buildBookingUrl } from "../../runtime/booking-url";
import { openCheckoutOverlay } from "../../runtime/checkout";
import { EmbedElement } from "../base";

const buttonStyles = css`
  :host { display: inline-block; }
  .cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    border-radius: calc(var(--fhq-radius) - 2px);
    border: 1px solid transparent;
    background: var(--fhq-color-primary);
    color: #fff;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    text-decoration: none;
    transition: filter 120ms ease;
    font-family: inherit;
  }
  .cta:hover { filter: brightness(0.94); }
  .cta[disabled] { opacity: 0.6; cursor: wait; }
  .cta--ghost {
    background: transparent;
    color: var(--fhq-color-primary);
    border-color: var(--fhq-color-primary);
  }
`;

@customElement("fleethq-book-button")
export class FleetHQBookButton extends EmbedElement {
  static styles = [...EmbedElement.styles, buttonStyles];

  @property({ type: Number, attribute: "fleet-id" }) fleetId: number | null = null;
  @property({ type: String }) label: string | null = null;
  @property({ type: String, attribute: "pickup" }) pickup: string | null = null;
  @property({ type: String, attribute: "dropoff" }) dropoff: string | null = null;
  @property({ type: Number, attribute: "location-id" }) locationId: number | null = null;
  @property({ type: String, attribute: "variant" }) variant: "solid" | "ghost" = "solid";
  @property({ type: Boolean, attribute: "new-tab" }) newTab = false;
  @property({ type: String, attribute: "checkout-target" }) checkoutTarget: "redirect" | "iframe" = "redirect";

  private busy = false;

  private async onClick(e: Event): Promise<void> {
    e.preventDefault();
    if (this.busy || !this.fleetId) return;
    this.busy = true;
    this.requestUpdate();
    try {
      const url = await buildBookingUrl({
        fleetId: this.fleetId,
        pickup: this.pickup || undefined,
        dropoff: this.dropoff || undefined,
        locationId: this.locationId || undefined,
        tenant: this.tenant || undefined,
      });
      this.emitEvent("fleethq:book", { fleetId: this.fleetId, url, target: this.checkoutTarget });
      if (this.checkoutTarget === "iframe") {
        const result = await openCheckoutOverlay({ url, tenant: this.tenant });
        this.emitEvent("fleethq:checkout-result", { fleetId: this.fleetId, ...result });
        return;
      }
      if (this.newTab) window.open(url, "_blank", "noopener,noreferrer");
      else window.location.href = url;
    } finally {
      this.busy = false;
      this.requestUpdate();
    }
  }

  render() {
    const disabled = this.busy || !this.fleetId;
    const label = this.label || "Book now";
    const classes = this.variant === "ghost" ? "cta cta--ghost" : "cta";
    return html`
      <button
        class=${classes}
        type="button"
        ?disabled=${disabled}
        @click=${this.onClick}
      >
        ${this.busy ? "Loading…" : label}
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "fleethq-book-button": FleetHQBookButton;
  }
}
