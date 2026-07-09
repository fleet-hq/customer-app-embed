import "./components/card";
import "./components/catalog";
import "./components/search";
import "./components/book-button";
import "./components/checkout-overlay";

import { buildBookingUrl } from "./runtime/booking-url";
import { overrideSettings } from "./runtime/settings";
import { loadTenantConfig } from "./runtime/tenant";
import type { EmbedGlobal, EmbedInitOptions } from "./runtime/types";

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
};

if (typeof window !== "undefined") {
  window.FleetHQEmbed = Object.assign(window.FleetHQEmbed ?? {}, api);
}

export default api;
