import { css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import "../card";
import { fetchFleets } from "../../runtime/api";
import { resolveTenantSlug } from "../../runtime/tenant";
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

  @state() private fleets: FleetSummary[] = [];
  @state() private page = 1;
  @state() private hasNext = false;
  @state() private hasPrev = false;
  @state() private fetching = false;
  @state() private fetchError: string | null = null;
  @state() private query = "";

  connectedCallback(): void {
    super.connectedCallback();
    this.load();
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
