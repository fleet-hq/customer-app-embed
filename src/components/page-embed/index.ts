import { css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { originMatches, unpackMessage, type EmbedInboundMessage } from "../../runtime/messages";
import { resolveTenantSlug } from "../../runtime/tenant";
import { EmbedElement } from "../base";

const styles = css`
  :host {
    display: block;
    width: 100%;
  }
  .frame {
    display: block;
    width: 100%;
    border: 0;
    background: transparent;
    transition: height 180ms ease;
  }
  :host([overlay]) .anchor {
    position: relative;
    display: block;
    width: 100%;
  }
  :host([overlay]) .frame {
    position: absolute;
    inset: 0 0 auto 0;
    z-index: 999;
    transition: height 120ms ease;
  }
  .error {
    padding: 32px;
    text-align: center;
    color: #b91c1c;
    font-size: 14px;
    border: 1px dashed #fecaca;
    border-radius: var(--fhq-radius);
  }
`;

@customElement("fleethq-page-embed")
export class FleetHQPageEmbed extends EmbedElement {
  static styles = [...EmbedElement.styles, styles];

  @property({ type: String }) path = "/fleet";
  @property({ type: Number, attribute: "min-height" }) minHeight = 720;
  @property({ type: String, attribute: "redirect-to" }) redirectTo: string | null = null;
  @property({ type: Boolean }) bare = false;
  @property({ type: Boolean, reflect: true }) overlay = false;

  @state() private iframeHeight = 720;
  @state() private frameUrl: string | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.iframeHeight = this.minHeight;
    window.addEventListener("message", this.onMessage);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("message", this.onMessage);
  }

  updated(changed: Map<string, unknown>): void {
    super.updated(changed);
    if (this.config && !this.frameUrl) {
      this.frameUrl = this.buildFrameUrl();
    }
  }

  private buildFrameUrl(): string | null {
    if (!this.config) return null;
    const base = this.config.checkout_base_url || `https://${this.config.slug}`;
    if (!base || base === "https://") return null;
    let slug: string;
    try {
      slug = resolveTenantSlug(this.tenant);
    } catch {
      slug = this.config.slug;
    }
    const path = this.path.startsWith("/") ? this.path : `/${this.path}`;
    const url = new URL(`${base.replace(/\/$/, "")}${path}`);
    url.searchParams.set("tenant", slug);
    url.searchParams.set("embed", "1");
    if (this.redirectTo) url.searchParams.set("embed_redirect", this.redirectTo);
    if (this.bare) url.searchParams.set("bare", "1");

    const parentParams = new URLSearchParams(window.location.search);
    for (const key of ["pickup", "dropoff", "location", "pickupDate", "pickupTime", "returnDate", "returnTime", "pickupLocId", "dropoffLocId"]) {
      const v = parentParams.get(key);
      if (v) url.searchParams.set(key, v);
    }
    return url.toString();
  }

  private onMessage = (event: MessageEvent): void => {
    if (!this.frameUrl) return;
    if (!originMatches(event.origin, this.frameUrl)) return;
    const payload = unpackMessage<EmbedInboundMessage>(event.data);
    if (!payload) return;
    switch (payload.type) {
      case "resize": {
        const requested = Math.max(this.minHeight, Math.min(payload.height, 5000));
        if (Math.abs(requested - this.iframeHeight) < 8) break;
        this.iframeHeight = requested;
        break;
      }
      case "navigate":
        this.emitEvent("fleethq:navigate", payload);
        break;
      case "handoff":
        window.location.href = payload.url;
        break;
      default:
        break;
    }
  };

  render() {
    if (this.configError) return html`<div class="error">${this.configError}</div>`;
    if (!this.frameUrl) return nothing;
    const iframe = html`
      <iframe
        class="frame"
        src=${this.frameUrl}
        title=${this.path}
        allow="payment; clipboard-write"
        style="height:${this.iframeHeight}px"
      ></iframe>
    `;
    if (this.overlay) {
      return html`<div class="anchor" style="min-height:${this.minHeight}px">${iframe}</div>`;
    }
    return iframe;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "fleethq-page-embed": FleetHQPageEmbed;
  }
}
