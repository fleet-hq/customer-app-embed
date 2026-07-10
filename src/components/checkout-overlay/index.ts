import { css, html, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";

import {
  clampHeight,
  originMatches,
  packMessage,
  unpackMessage,
  type EmbedInboundMessage,
} from "../../runtime/messages";
import { EmbedElement } from "../base";

const overlayStyles = css`
  :host {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 2147483000;
  }
  :host([open]) { display: block; }
  .backdrop {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(2px);
    animation: fhq-fade 160ms ease;
  }
  .shell {
    position: absolute;
    inset: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    align-items: stretch;
    justify-content: center;
    padding: 16px;
  }
  @media (min-width: 768px) {
    .shell { padding: 32px; align-items: center; }
  }
  .modal {
    background: var(--fhq-color-surface);
    border-radius: var(--fhq-radius);
    width: min(960px, 100%);
    max-height: none;
    height: auto;
    min-height: 480px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 24px 60px rgba(15, 23, 42, 0.35);
    animation: fhq-scale 180ms cubic-bezier(0.2, 0.9, 0.3, 1.1);
    margin: auto;
  }
  @media (min-width: 768px) {
    .modal { max-height: min(92dvh, 940px); }
  }
  header {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-bottom: 1px solid rgba(15, 23, 42, 0.06);
    background: linear-gradient(180deg, #fafafb 0%, #f4f5f8 100%);
  }
  .title {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--fhq-color-text);
  }
  .close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 1px solid rgba(15, 23, 42, 0.12);
    background: #ffffff;
    color: var(--fhq-color-text);
    font-size: 18px;
    line-height: 1;
    border-radius: 8px;
    cursor: pointer;
    transition: background 120ms;
  }
  .close:hover { background: #f1f5f9; }
  iframe {
    flex: 1 1 auto;
    width: 100%;
    border: 0;
    background: var(--fhq-color-surface);
    min-height: 640px;
    display: block;
  }
  .status {
    padding: 40px;
    text-align: center;
    color: var(--fhq-color-text-muted);
    font-size: 14px;
  }
  .status--error { color: #b91c1c; }
  @keyframes fhq-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes fhq-scale {
    from { transform: translateY(12px) scale(0.98); opacity: 0; }
    to { transform: none; opacity: 1; }
  }
`;

@customElement("fleethq-checkout-overlay")
export class FleetHQCheckoutOverlay extends EmbedElement {
  static styles = [...EmbedElement.styles, overlayStyles];

  @property({ type: String }) url: string | null = null;
  @property({ type: String }) title = "Complete your booking";
  @property({ type: Boolean, reflect: true }) open = false;

  @state() private iframeHeight = 640;
  @state() private errorMessage: string | null = null;
  @state() private lastPayload: EmbedInboundMessage | null = null;

  @query("iframe") private iframeEl?: HTMLIFrameElement;

  private previouslyFocused: Element | null = null;
  private messageHandler = (event: MessageEvent) => this.handleMessage(event);

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("message", this.messageHandler);
    document.addEventListener("keydown", this.onKeydown);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("message", this.messageHandler);
    document.removeEventListener("keydown", this.onKeydown);
  }

  updated(changed: Map<string, unknown>): void {
    super.updated(changed);
    if (changed.has("open")) {
      if (this.open) {
        this.previouslyFocused = document.activeElement;
        document.body.style.overflow = "hidden";
      } else {
        document.body.style.overflow = "";
        if (this.previouslyFocused instanceof HTMLElement) this.previouslyFocused.focus();
        this.errorMessage = null;
      }
    }
  }

  show(url: string): void {
    this.errorMessage = null;
    this.url = url;
    this.open = true;
  }

  close(reason: "user" | "success" | "error" = "user"): void {
    if (!this.open) return;
    this.open = false;
    this.emitEvent("fleethq:checkout-closed", { reason, lastPayload: this.lastPayload });
  }

  private onKeydown = (event: KeyboardEvent): void => {
    if (!this.open) return;
    if (event.key === "Escape") this.close("user");
  };

  private handleMessage(event: MessageEvent): void {
    if (!this.open || !this.url) return;
    if (!originMatches(event.origin, this.url)) return;

    const payload = unpackMessage<EmbedInboundMessage>(event.data);
    if (!payload) return;
    this.lastPayload = payload;

    switch (payload.type) {
      case "ready":
        if (payload.height) this.iframeHeight = clampHeight(payload.height);
        this.postToChild({ type: "hello", version: __EMBED_VERSION__, tenant: this.tenant || "" });
        this.emitEvent("fleethq:checkout-ready", { url: this.url });
        break;
      case "resize":
        this.iframeHeight = clampHeight(payload.height);
        break;
      case "navigate":
        this.emitEvent("fleethq:checkout-navigate", { url: payload.url });
        break;
      case "close":
        this.close("user");
        break;
      case "handoff":
        this.emitEvent("fleethq:checkout-handoff", { url: payload.url });
        window.location.href = payload.url;
        break;
      case "booking-complete":
        this.emitEvent("fleethq:checkout-complete", payload);
        this.close("success");
        break;
      case "booking-error":
        this.errorMessage = payload.message;
        this.emitEvent("fleethq:checkout-error", payload);
        break;
      default:
        break;
    }
  }

  private postToChild(payload: Parameters<typeof packMessage>[0]): void {
    if (!this.iframeEl || !this.url) return;
    try {
      const origin = new URL(this.url).origin;
      this.iframeEl.contentWindow?.postMessage(packMessage(payload), origin);
    } catch {
      // Origin unresolvable — drop the message.
    }
  }

  private onBackdrop = (): void => this.close("user");
  private stopPropagation = (e: Event): void => e.stopPropagation();

  render() {
    if (!this.open) return nothing;
    return html`
      <div class="backdrop" @click=${this.onBackdrop}></div>
      <div class="shell" @click=${this.onBackdrop}>
        <div
          class="modal"
          role="dialog"
          aria-modal="true"
          aria-label=${this.title}
          @click=${this.stopPropagation}
          style="min-height:${this.iframeHeight}px"
        >
          <header>
            <span class="title">${this.title}</span>
            <button class="close" type="button" @click=${() => this.close("user")} aria-label="Close">×</button>
          </header>
          ${this.errorMessage
            ? html`<div class="status status--error">${this.errorMessage}</div>`
            : nothing}
          ${this.url
            ? html`<iframe
                src=${this.url}
                title=${this.title}
                allow="payment; clipboard-write"
                style="height:${this.iframeHeight}px"
              ></iframe>`
            : html`<div class="status">Loading…</div>`}
        </div>
      </div>
    `;
  }
}

declare const __EMBED_VERSION__: string;

declare global {
  interface HTMLElementTagNameMap {
    "fleethq-checkout-overlay": FleetHQCheckoutOverlay;
  }
}
