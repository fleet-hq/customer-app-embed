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
    transition: opacity 260ms ease, height 180ms ease;
  }
  .frame.loading {
    opacity: 0;
    pointer-events: none;
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
    transition: opacity 260ms ease, height 120ms ease;
  }
  .skeleton {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 14px;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.55) 0%,
      rgba(255, 255, 255, 0.85) 40%,
      rgba(255, 255, 255, 0.55) 80%
    );
    background-size: 200% 100%;
    animation: fleethq-skeleton 1.4s ease-in-out infinite;
    pointer-events: none;
    box-shadow: 0 4px 24px rgba(15, 23, 42, 0.08);
  }
  :host([bare]) .skeleton,
  :host([overlay]) .skeleton {
    background: linear-gradient(
      90deg,
      rgba(148, 163, 184, 0.16) 0%,
      rgba(148, 163, 184, 0.28) 40%,
      rgba(148, 163, 184, 0.16) 80%
    );
    background-size: 200% 100%;
    box-shadow: none;
  }
  @keyframes fleethq-skeleton {
    0% { background-position: 100% 0; }
    100% { background-position: -100% 0; }
  }
  .stage {
    position: relative;
    display: block;
    width: 100%;
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
  @property({ type: Boolean, reflect: true }) bare = false;
  @property({ type: Boolean, reflect: true }) overlay = false;

  @state() private iframeHeight = 720;
  @state() private frameUrl: string | null = null;
  @state() private loaded = false;

  private fallbackTimer: number | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.iframeHeight = this.minHeight;
    window.addEventListener("message", this.onMessage);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("message", this.onMessage);
    if (this.fallbackTimer) {
      window.clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  updated(changed: Map<string, unknown>): void {
    super.updated(changed);
    if (this.config && !this.frameUrl) {
      this.frameUrl = this.buildFrameUrl();
      if (this.frameUrl && this.fallbackTimer == null) {
        this.fallbackTimer = window.setTimeout(() => {
          this.loaded = true;
        }, 8000);
      }
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

  private markLoaded = (): void => {
    if (this.loaded) return;
    this.loaded = true;
    if (this.fallbackTimer) {
      window.clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  };

  private onMessage = (event: MessageEvent): void => {
    if (!this.frameUrl) return;
    if (!originMatches(event.origin, this.frameUrl)) return;
    const payload = unpackMessage<EmbedInboundMessage>(event.data);
    if (!payload) return;
    switch (payload.type) {
      case "resize": {
        this.markLoaded();
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
    if (!this.frameUrl) {
      return html`<div class="stage" style="height:${this.minHeight}px"><div class="skeleton"></div></div>`;
    }
    const iframe = html`
      <iframe
        class=${this.loaded ? "frame" : "frame loading"}
        src=${this.frameUrl}
        title=${this.path}
        allow="payment; clipboard-write"
        style="height:${this.iframeHeight}px"
        @load=${this.markLoaded}
      ></iframe>
    `;
    const skeleton = this.loaded
      ? nothing
      : html`<div class="skeleton"></div>`;
    if (this.overlay) {
      return html`<div class="anchor stage" style="min-height:${this.minHeight}px">${skeleton}${iframe}</div>`;
    }
    return html`<div class="stage" style="min-height:${this.minHeight}px">${skeleton}${iframe}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "fleethq-page-embed": FleetHQPageEmbed;
  }
}
