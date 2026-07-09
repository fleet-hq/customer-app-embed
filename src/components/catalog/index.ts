import { css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import "../card";
import { fetchFleets } from "../../runtime/api";
import { buildBookingUrl } from "../../runtime/booking-url";
import { resolveTenantSlug } from "../../runtime/tenant";
import { originMatches, unpackMessage, type EmbedInboundMessage } from "../../runtime/messages";
import type { FleetSummary, Paginated } from "../../runtime/types";
import { EmbedElement } from "../base";

const catalogStyles = css`
  .catalog {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .catalog__toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .catalog__search {
    flex: 1 1 240px;
    padding: 10px 14px;
    border-radius: calc(var(--fhq-radius) - 2px);
    border: 1px solid var(--fhq-color-border);
    font-size: 14px;
    font-family: inherit;
    color: inherit;
    background: var(--fhq-color-surface);
    min-width: 200px;
  }
  .catalog__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 16px;
  }
  .catalog__empty,
  .catalog__error {
    padding: 32px;
    text-align: center;
    border: 1px dashed var(--fhq-color-border);
    border-radius: var(--fhq-radius);
    color: var(--fhq-color-text-muted);
  }
  .catalog__error { color: #b91c1c; border-color: #fecaca; }
  .catalog__pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    padding-top: 4px;
    color: var(--fhq-color-text-muted);
    font-size: 13px;
  }
  .inline {
    display: flex;
    flex-direction: column;
    background: var(--fhq-color-surface);
    border: 1px solid var(--fhq-color-border);
    border-radius: var(--fhq-radius);
    overflow: hidden;
  }
  .inline__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--fhq-color-surface-alt);
    border-bottom: 1px solid var(--fhq-color-border);
  }
  .inline__title { font-size: 14px; font-weight: 600; color: var(--fhq-color-text); }
  .inline__back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: calc(var(--fhq-radius) - 4px);
    border: 1px solid var(--fhq-color-border);
    background: transparent;
    color: var(--fhq-color-text);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }
  .inline__back:hover { background: rgba(15, 23, 42, 0.05); }
  .inline iframe {
    width: 100%;
    border: 0;
    display: block;
    background: var(--fhq-color-surface);
  }
`;

@customElement("fleethq-fleet-catalog")
export class FleetHQFleetCatalog extends EmbedElement {
  static styles = [...EmbedElement.styles, catalogStyles];

  @property({ type: Number, attribute: "page-size" }) pageSize = 12;
  @property({ type: String, attribute: "cta-label" }) ctaLabel = "Book now";
  @property({ type: Boolean, attribute: "no-search" }) noSearch = false;
  @property({ type: String, attribute: "pickup" }) pickup: string | null = null;
  @property({ type: String, attribute: "dropoff" }) dropoff: string | null = null;
  @property({ type: Number, attribute: "location-id" }) locationId: number | null = null;
  @property({ type: String, attribute: "checkout-target" }) checkoutTarget: "redirect" | "iframe" | "inline" = "redirect";
  @property({ type: Boolean, attribute: "no-book" }) noBook = false;
  @property({ type: Number, attribute: "inline-min-height" }) inlineMinHeight = 720;
  @property({ type: String, attribute: "back-label" }) backLabel = "Back to fleet";

  @state() private fleets: FleetSummary[] = [];
  @state() private page = 1;
  @state() private hasNext = false;
  @state() private hasPrev = false;
  @state() private fetching = false;
  @state() private fetchError: string | null = null;
  @state() private query = "";
  @state() private inlineUrl: string | null = null;
  @state() private inlineHeight = 720;
  @state() private inlineTitle = "Complete your booking";

  private messageHandler = (event: MessageEvent) => this.handleInlineMessage(event);

  connectedCallback(): void {
    super.connectedCallback();
    this.load();
    window.addEventListener("message", this.messageHandler);
    this.addEventListener("fleethq:book", this.onBookIntercept as unknown as EventListener);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("message", this.messageHandler);
    this.removeEventListener("fleethq:book", this.onBookIntercept as unknown as EventListener);
  }

  updated(changed: Map<string, unknown>): void {
    super.updated(changed);
    if (
      changed.has("tenant") ||
      changed.has("pickup") ||
      changed.has("dropoff") ||
      changed.has("locationId")
    ) {
      this.page = 1;
      this.load();
    }
  }

  private async load(): Promise<void> {
    this.fetching = true;
    this.fetchError = null;
    try {
      const slug = resolveTenantSlug(this.tenant);
      const result: Paginated<FleetSummary> = await fetchFleets(slug, {
        q: this.query || undefined,
        pickup: this.pickup || undefined,
        dropoff: this.dropoff || undefined,
        location: this.locationId || undefined,
        page: this.page,
        page_size: this.pageSize,
      });
      this.fleets = result.results || [];
      this.hasNext = Boolean(result.next);
      this.hasPrev = Boolean(result.previous);
      this.emitEvent("fleethq:catalog-loaded", {
        page: this.page,
        count: result.count,
        results: this.fleets,
      });
    } catch (err) {
      this.fetchError = err instanceof Error ? err.message : String(err);
    } finally {
      this.fetching = false;
    }
  }

  private onBookIntercept = async (event: CustomEvent): Promise<void> => {
    if (this.checkoutTarget !== "inline") return;
    event.stopPropagation();
    const detail = event.detail as { fleet?: FleetSummary; fleetId?: number; url?: string };
    const fleet = detail.fleet || null;
    const fleetId = fleet?.id ?? detail.fleetId;
    if (!fleetId) return;
    const url =
      detail.url ||
      (await buildBookingUrl({
        fleetId,
        pickup: this.pickup || undefined,
        dropoff: this.dropoff || undefined,
        locationId: this.locationId || undefined,
        tenant: this.tenant || undefined,
      }));
    const decorated = this.decorateEmbedUrl(url);
    this.inlineHeight = this.inlineMinHeight;
    this.inlineUrl = decorated;
    if (fleet) this.inlineTitle = `Complete your booking — ${fleet.year} ${fleet.make} ${fleet.model}`;
    this.updateComplete.then(() => {
      this.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  private decorateEmbedUrl(raw: string): string {
    try {
      const url = new URL(raw);
      url.searchParams.set("embed", "1");
      url.searchParams.set("embed_version", "0.1.0");
      if (this.tenant) url.searchParams.set("embed_tenant", this.tenant);
      return url.toString();
    } catch {
      return raw;
    }
  }

  private handleInlineMessage(event: MessageEvent): void {
    if (!this.inlineUrl) return;
    if (!originMatches(event.origin, this.inlineUrl)) return;
    const payload = unpackMessage<EmbedInboundMessage>(event.data);
    if (!payload) return;
    switch (payload.type) {
      case "resize":
        this.inlineHeight = Math.max(this.inlineMinHeight, Math.min(payload.height, 5000));
        break;
      case "booking-complete":
        this.emitEvent("fleethq:checkout-complete", payload);
        this.closeInline("success");
        break;
      case "booking-error":
        this.emitEvent("fleethq:checkout-error", payload);
        break;
      case "close":
        this.closeInline("user");
        break;
      case "handoff":
        window.location.href = payload.url;
        break;
      default:
        break;
    }
  }

  private closeInline(reason: "user" | "success"): void {
    this.inlineUrl = null;
    this.emitEvent("fleethq:checkout-closed", { reason });
  }

  private onSearch(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.query = input.value;
    this.page = 1;
    this.debounceLoad();
  }

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private debounceLoad(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.load(), 250);
  }

  private prev = (): void => {
    if (!this.hasPrev) return;
    this.page = Math.max(1, this.page - 1);
    this.load();
  };

  private next = (): void => {
    if (!this.hasNext) return;
    this.page += 1;
    this.load();
  };

  render() {
    if (this.configError) return html`<div class="catalog"><div class="catalog__error">${this.configError}</div></div>`;

    if (this.checkoutTarget === "inline" && this.inlineUrl) {
      return html`
        <div class="catalog" part="catalog">
          <div class="inline" part="inline">
            <div class="inline__bar">
              <span class="inline__title">${this.inlineTitle}</span>
              <button class="inline__back" type="button" @click=${() => this.closeInline("user")}>
                ← ${this.backLabel}
              </button>
            </div>
            <iframe
              src=${this.inlineUrl}
              title=${this.inlineTitle}
              allow="payment; clipboard-write"
              style="height:${this.inlineHeight}px"
            ></iframe>
          </div>
        </div>
      `;
    }

    const childTarget = this.checkoutTarget;

    return html`
      <div class="catalog" part="catalog">
        ${this.noSearch
          ? nothing
          : html`
              <div class="catalog__toolbar">
                <input
                  class="catalog__search"
                  type="search"
                  placeholder="Search fleet…"
                  .value=${this.query}
                  @input=${this.onSearch}
                />
              </div>
            `}

        ${this.fetchError
          ? html`<div class="catalog__error">${this.fetchError}</div>`
          : this.fleets.length === 0 && !this.fetching
            ? html`<div class="catalog__empty">No vehicles available right now.</div>`
            : html`
                <div class="catalog__grid">
                  ${this.fleets.map(
                    (fleet) => html`
                      <fleethq-vehicle-card
                        tenant=${this.tenant || nothing}
                        cta-label=${this.ctaLabel}
                        pickup=${this.pickup || nothing}
                        dropoff=${this.dropoff || nothing}
                        checkout-target=${childTarget}
                        ?no-book=${this.noBook}
                        .fleet=${fleet}
                      ></fleethq-vehicle-card>
                    `,
                  )}
                </div>
                <div class="catalog__pagination">
                  <button class="fhq-button fhq-button--ghost" type="button" ?disabled=${!this.hasPrev} @click=${this.prev}>Prev</button>
                  <span>Page ${this.page}</span>
                  <button class="fhq-button fhq-button--ghost" type="button" ?disabled=${!this.hasNext} @click=${this.next}>Next</button>
                </div>
              `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "fleethq-fleet-catalog": FleetHQFleetCatalog;
  }
}
