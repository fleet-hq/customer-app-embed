import { LitElement, css, unsafeCSS } from "lit";
import { property } from "lit/decorators.js";

import { loadTenantConfig } from "../runtime/tenant";
import { applyThemeToHost } from "../runtime/theme";
import type { TenantConfig } from "../runtime/types";

export const baseTokens = css`
  :host {
    --fhq-color-primary: #111827;
    --fhq-color-secondary: #2563eb;
    --fhq-color-text: #0f172a;
    --fhq-color-text-muted: #6b7280;
    --fhq-color-border: #e5e7eb;
    --fhq-color-surface: #ffffff;
    --fhq-color-surface-alt: #f9fafb;
    --fhq-radius: 12px;
    --fhq-font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    display: block;
    color: var(--fhq-color-text);
    font-family: var(--fhq-font-family);
    box-sizing: border-box;
  }
  *, *::before, *::after { box-sizing: border-box; }
`;

export const buttonStyles = css`
  .fhq-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 16px;
    border-radius: calc(var(--fhq-radius) - 2px);
    border: 1px solid transparent;
    background: var(--fhq-color-primary);
    color: #fff;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    text-decoration: none;
    transition: filter 120ms ease;
  }
  .fhq-button:hover { filter: brightness(0.94); }
  .fhq-button--ghost {
    background: transparent;
    color: var(--fhq-color-primary);
    border-color: var(--fhq-color-border);
  }
`;

export abstract class EmbedElement extends LitElement {
  static styles = [baseTokens, buttonStyles, unsafeCSS("")];

  @property({ type: String }) tenant: string | null = null;

  protected config: TenantConfig | null = null;
  protected configError: string | null = null;
  protected loading = true;

  connectedCallback(): void {
    super.connectedCallback();
    this.loadConfig();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, _old, value);
    if (name === "tenant") this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    try {
      this.loading = true;
      this.config = await loadTenantConfig(this.tenant);
      applyThemeToHost(this, this.config.theme);
      this.configError = null;
    } catch (err) {
      this.config = null;
      this.configError = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
      this.requestUpdate();
    }
  }

  protected emitEvent<T>(name: string, detail: T): void {
    this.dispatchEvent(
      new CustomEvent(name, {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }
}
