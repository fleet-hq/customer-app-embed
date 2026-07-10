import type { BuildBookingUrlParams } from "./types";
import { buildBookingUrl } from "./booking-url";
import { originMatches, unpackMessage, type EmbedInboundMessage } from "./messages";

const CONTAINER_CLASS = "fhq-inline-checkout";
const NAMESPACE = "fleethq:embed";

interface OpenInlineParams extends Partial<BuildBookingUrlParams> {
  anchor: Element;
  target?: Element | null;
  title?: string;
  /** Explicit URL to load instead of building one from BuildBookingUrlParams. */
  url?: string;
}

let activeContainer: HTMLElement | null = null;

const injectStylesheet = (): void => {
  if (document.getElementById("fhq-inline-styles")) return;
  const style = document.createElement("style");
  style.id = "fhq-inline-styles";
  style.textContent = `
    .${CONTAINER_CLASS} {
      margin: 24px 0;
      background: #ffffff;
      border-radius: 16px;
      border: 1px solid rgba(15, 23, 42, 0.08);
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
      overflow: hidden;
      font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      animation: fhq-slide-in 220ms cubic-bezier(0.2, 0.9, 0.3, 1.1);
    }
    .${CONTAINER_CLASS}__bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      background: linear-gradient(180deg, #fafafb 0%, #f4f5f8 100%);
      border-bottom: 1px solid rgba(15, 23, 42, 0.06);
    }
    .${CONTAINER_CLASS}__title {
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
      letter-spacing: -0.01em;
    }
    .${CONTAINER_CLASS}__close {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 8px;
      border: 1px solid rgba(15, 23, 42, 0.12);
      background: #ffffff;
      color: #0f172a;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 120ms;
      font-family: inherit;
    }
    .${CONTAINER_CLASS}__close:hover { background: #f1f5f9; }
    .${CONTAINER_CLASS}__loading {
      padding: 48px;
      text-align: center;
      color: #64748b;
      font-size: 14px;
    }
    .${CONTAINER_CLASS}__iframe {
      display: block;
      width: 100%;
      border: 0;
      background: #ffffff;
      transition: height 180ms ease;
    }
    @keyframes fhq-slide-in {
      from { transform: translateY(10px); opacity: 0; }
      to { transform: none; opacity: 1; }
    }
  `;
  document.head.appendChild(style);
};

const decorateEmbedUrl = (raw: string): string => {
  try {
    const url = new URL(raw);
    url.searchParams.set("embed", "1");
    url.searchParams.set("embed_version", "0.1.0");
    return url.toString();
  } catch {
    return raw;
  }
};

const removeActive = (): void => {
  if (activeContainer && activeContainer.parentElement) {
    activeContainer.parentElement.removeChild(activeContainer);
  }
  activeContainer = null;
};

const dispatch = (target: Element, name: string, detail: unknown): void => {
  target.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
};

export const openInlineCheckout = async (params: OpenInlineParams): Promise<void> => {
  injectStylesheet();
  const { anchor, target, title = "Complete your booking", url: explicitUrl, ...urlParams } = params;

  removeActive();

  const container = document.createElement("div");
  container.className = CONTAINER_CLASS;
  container.setAttribute("role", "region");
  container.setAttribute("aria-label", title);

  const bar = document.createElement("div");
  bar.className = `${CONTAINER_CLASS}__bar`;

  const label = document.createElement("span");
  label.className = `${CONTAINER_CLASS}__title`;
  label.textContent = title;

  const closeBtn = document.createElement("button");
  closeBtn.className = `${CONTAINER_CLASS}__close`;
  closeBtn.type = "button";
  closeBtn.innerHTML = "&larr; Back";
  closeBtn.addEventListener("click", () => {
    dispatch(anchor, "fleethq:checkout-closed", { reason: "user" });
    removeActive();
  });

  bar.appendChild(label);
  bar.appendChild(closeBtn);

  const loading = document.createElement("div");
  loading.className = `${CONTAINER_CLASS}__loading`;
  loading.textContent = "Loading checkout…";

  container.appendChild(bar);
  container.appendChild(loading);

  if (target) {
    target.replaceChildren(container);
  } else {
    const parent = anchor.parentElement || document.body;
    parent.insertBefore(container, anchor.nextSibling);
  }
  activeContainer = container;

  const url = decorateEmbedUrl(
    explicitUrl ??
      (await buildBookingUrl({
        fleetId: urlParams.fleetId ?? 0,
        pickup: urlParams.pickup,
        dropoff: urlParams.dropoff,
        locationId: urlParams.locationId,
        tenant: urlParams.tenant,
      })),
  );

  const iframe = document.createElement("iframe");
  iframe.className = `${CONTAINER_CLASS}__iframe`;
  iframe.src = url;
  iframe.setAttribute("title", title);
  iframe.setAttribute("allow", "payment; clipboard-write");
  iframe.style.height = "720px";

  container.replaceChild(iframe, loading);

  container.scrollIntoView({ behavior: "smooth", block: "start" });

  const messageHandler = (event: MessageEvent): void => {
    if (!originMatches(event.origin, url)) return;
    if (!event.data || typeof event.data !== "object") return;
    if ((event.data as { namespace?: string }).namespace !== NAMESPACE) return;
    const payload = unpackMessage<EmbedInboundMessage>(event.data);
    if (!payload) return;
    switch (payload.type) {
      case "resize": {
        // Growth guard: only accept the new height if it's meaningfully
        // different from the current one. Stops runaway feedback loops
        // where the iframe body inherits our height (100vh / flex-grow)
        // and reports a slightly larger value each cycle.
        const requested = Math.min(Math.max(payload.height, 480), 4000);
        const current = parseInt(iframe.style.height, 10) || 0;
        if (Math.abs(requested - current) < 8) break;
        iframe.style.height = `${requested}px`;
        break;
      }
      case "booking-complete":
        dispatch(anchor, "fleethq:checkout-complete", payload);
        window.removeEventListener("message", messageHandler);
        removeActive();
        break;
      case "booking-error":
        dispatch(anchor, "fleethq:checkout-error", payload);
        break;
      case "close":
        window.removeEventListener("message", messageHandler);
        removeActive();
        break;
      case "handoff":
        window.location.href = payload.url;
        break;
      default:
        break;
    }
  };

  window.addEventListener("message", messageHandler);
};
