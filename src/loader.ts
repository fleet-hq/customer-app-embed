import "./components/card";
import "./components/catalog";
import "./components/search";
import "./components/book-button";
import "./components/checkout-overlay";

import { buildBookingUrl } from "./runtime/booking-url";
import { buildManageUrl } from "./runtime/manage-url";
import { openCheckoutOverlay } from "./runtime/checkout";
import { openInlineCheckout } from "./runtime/inline-checkout";
import { loadSession } from "./runtime/session";
import { overrideSettings } from "./runtime/settings";
import { loadTenantConfig } from "./runtime/tenant";
import type { BuildBookingUrlParams, EmbedGlobal, EmbedInitOptions } from "./runtime/types";

const openCheckout = async (params: BuildBookingUrlParams) => {
  const url = await buildBookingUrl(params);
  return openCheckoutOverlay({ url, tenant: params.tenant });
};

const AUTO_ATTR = "data-fleethq-book";
const MODAL_ATTR = "data-fleethq-book-modal";
const MANAGE_ATTR = "data-fleethq-manage";

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

const resolveInlineTarget = (trigger: Element): Element | null => {
  const targetSelector = trigger.getAttribute("data-fleethq-book-target");
  if (targetSelector) {
    try {
      const t = document.querySelector(targetSelector);
      if (t) return t;
    } catch {
      /* invalid selector — ignore */
    }
  }
  return (
    document.querySelector("[data-fleethq-checkout]") ||
    document.getElementById("fleethq-checkout")
  );
};

const attachAutoOpen = (): void => {
  if (typeof document === "undefined") return;
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      // Manage-bookings trigger — opens the tenant's /manage lookup page.
      // Attribute value is ignored (presence alone is the switch), so
      // partners can drop it on a link / button / CMS field with no config.
      const manageTrigger = target.closest(`[${MANAGE_ATTR}]`);
      if (manageTrigger) {
        event.preventDefault();
        const tenant = manageTrigger.getAttribute("data-fleethq-tenant") || undefined;
        const inlineTarget = resolveInlineTarget(manageTrigger);
        const wantsModal =
          manageTrigger.hasAttribute(MODAL_ATTR) || inlineTarget === null;
        buildManageUrl({ tenant })
          .then((url) =>
            wantsModal
              ? openCheckoutOverlay({ url, tenant, title: "Manage your booking" }).then(() => undefined)
              : openInlineCheckout({
                  anchor: manageTrigger,
                  target: inlineTarget,
                  title: "Manage your booking",
                  url,
                }),
          )
          .catch((err) => console.warn("[FleetHQEmbed] openManage failed:", err));
        return;
      }

      // Book trigger — opens the checkout for a specific fleet id.
      const trigger = target.closest(`[${AUTO_ATTR}]`);
      if (!trigger) return;
      const params = parseAutoAttribute(trigger);
      if (!params) return;
      event.preventDefault();

      const inlineTarget = resolveInlineTarget(trigger);
      // No explicit inline container on the page → fall back to the
      // modal overlay. Prevents partners with a header/footer/dropdown
      // trigger from getting a checkout squeezed into whatever column
      // the trigger element happens to live in.
      const wantsModal = trigger.hasAttribute(MODAL_ATTR) || inlineTarget === null;
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

const restoreSessionIfAny = (): void => {
  const state = loadSession();
  if (!state) return;
  if (state.mode !== "inline") return;
  // Find a place to remount. Prefer the target selector we used originally,
  // then fall back to the marker attribute / id conventions, then body.
  let target: Element | null = null;
  if (state.targetSelector) {
    try {
      target = document.querySelector(state.targetSelector);
    } catch {
      target = null;
    }
  }
  if (!target) target = document.querySelector("[data-fleethq-checkout]");
  if (!target) target = document.getElementById("fleethq-checkout");
  if (!target) return;
  openInlineCheckout({
    anchor: target,
    target,
    url: state.url,
    title: state.title,
    tenant: state.tenant ?? undefined,
    skipSessionSave: true,
  }).catch((err) => console.warn("[FleetHQEmbed] session restore failed:", err));
};

if (typeof window !== "undefined") {
  window.FleetHQEmbed = Object.assign(window.FleetHQEmbed ?? {}, api);
  const boot = (): void => {
    attachAutoOpen();
    restoreSessionIfAny();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
}

export default api;
