import type { FleetHQCheckoutOverlay } from "../components/checkout-overlay";

const OVERLAY_TAG = "fleethq-checkout-overlay";

interface OpenCheckoutParams {
  url: string;
  tenant?: string | null;
  title?: string;
}

interface CheckoutResult {
  reason: "success" | "user" | "error";
  bookingId?: number;
  referenceNumber?: string;
}

let singleton: FleetHQCheckoutOverlay | null = null;

const ensureOverlay = (): FleetHQCheckoutOverlay => {
  if (singleton && document.body.contains(singleton)) return singleton;
  const el = document.createElement(OVERLAY_TAG) as FleetHQCheckoutOverlay;
  document.body.appendChild(el);
  singleton = el;
  return el;
};

const decorateEmbedUrl = (raw: string, tenant?: string | null): string => {
  try {
    const url = new URL(raw);
    url.searchParams.set("embed", "1");
    url.searchParams.set("embed_version", __EMBED_VERSION__);
    if (tenant) url.searchParams.set("embed_tenant", tenant);
    return url.toString();
  } catch {
    return raw;
  }
};

export const openCheckoutOverlay = ({ url, tenant, title }: OpenCheckoutParams): Promise<CheckoutResult> => {
  const overlay = ensureOverlay();
  if (tenant) overlay.setAttribute("tenant", tenant);
  if (title) overlay.title = title;

  const target = decorateEmbedUrl(url, tenant);

  return new Promise((resolve) => {
    let bookingId: number | undefined;
    let referenceNumber: string | undefined;

    const onComplete = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      bookingId = detail.bookingId;
      referenceNumber = detail.referenceNumber;
    };
    const onClosed = (event: Event) => {
      cleanup();
      const detail = (event as CustomEvent).detail || {};
      resolve({
        reason: detail.reason || "user",
        bookingId,
        referenceNumber,
      });
    };
    const cleanup = () => {
      overlay.removeEventListener("fleethq:checkout-complete", onComplete);
      overlay.removeEventListener("fleethq:checkout-closed", onClosed);
    };

    overlay.addEventListener("fleethq:checkout-complete", onComplete);
    overlay.addEventListener("fleethq:checkout-closed", onClosed);
    overlay.show(target);
  });
};

declare const __EMBED_VERSION__: string;
