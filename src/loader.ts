import "./components/card";
import "./components/catalog";
import "./components/search";
import "./components/book-button";
import "./components/checkout-overlay";

import { buildBookingUrl } from "./runtime/booking-url";
import { openCheckoutOverlay } from "./runtime/checkout";
import { openInlineCheckout } from "./runtime/inline-checkout";
import { overrideSettings } from "./runtime/settings";
import { loadTenantConfig } from "./runtime/tenant";
import type { BuildBookingUrlParams, EmbedGlobal, EmbedInitOptions } from "./runtime/types";

const openCheckout = async (params: BuildBookingUrlParams) => {
  const url = await buildBookingUrl(params);
  return openCheckoutOverlay({ url, tenant: params.tenant });
};

const AUTO_ATTR = "data-fleethq-book";
const MODAL_ATTR = "data-fleethq-book-modal";

const parseAutoAttribute = (trigger: Element): BuildBookingUrlParams | null => {
  const raw = trigger.getAttribute(AUTO_ATTR);
  if (!raw) return null;
  const fleetId = Number(raw.trim());
  if (!Number.isFinite(fleetId) || fleetId <= 0) return null;
  return {
    fleetId,
    tenant: trigger.getAttribute("data-fleethq-tenant") || undefined,
    pickup: trigger.getAttribute("data-fleethq-pickup") || undefined,
    dropoff: trigger.getAttribute("data-fleethq-dropoff") || undefined,
    locationId: trigger.getAttribute("data-fleethq-location-id")
      ? Number(trigger.getAttribute("data-fleethq-location-id"))
      : undefined,
  };
};

const attachAutoOpen = (): void => {
  if (typeof document === "undefined") return;
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const trigger = target.closest(`[${AUTO_ATTR}]`);
      if (!trigger) return;
      const params = parseAutoAttribute(trigger);
      if (!params) return;
      event.preventDefault();

      const wantsModal = trigger.hasAttribute(MODAL_ATTR);
      let inlineTarget: Element | null = null;
      const targetSelector = trigger.getAttribute("data-fleethq-book-target");
      if (targetSelector) {
        try {
          inlineTarget = document.querySelector(targetSelector);
        } catch {
          inlineTarget = null;
        }
      }
      if (!inlineTarget) inlineTarget = document.getElementById("fleethq-checkout");

      const promise = wantsModal
        ? openCheckout(params)
        : openInlineCheckout({ anchor: trigger, target: inlineTarget, ...params });
      promise.catch((err) => {
        console.warn("[FleetHQEmbed] openCheckout failed:", err);
      });
    },
    { capture: true },
  );
};

const api: EmbedGlobal = {
  init(options: EmbedInitOptions = {}) {
    overrideSettings({
      apiBase: options.apiBase,
      defaultTenant: options.tenant ?? null,
    });
  },
  getConfig(tenant) {
    return loadTenantConfig(tenant);
  },
  buildBookingUrl(params) {
    return buildBookingUrl(params);
  },
  openCheckout(params) {
    return openCheckout(params);
  },
};

if (typeof window !== "undefined") {
  window.FleetHQEmbed = Object.assign(window.FleetHQEmbed ?? {}, api);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachAutoOpen, { once: true });
  } else {
    attachAutoOpen();
  }
}

export default api;
