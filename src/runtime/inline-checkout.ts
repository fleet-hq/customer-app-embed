import type { BuildBookingUrlParams } from "./types";
import { buildBookingUrl } from "./booking-url";
import { originMatches, unpackMessage, type EmbedInboundMessage } from "./messages";
import { clearSession, saveSession } from "./session";

const CONTAINER_CLASS = "fhq-inline-checkout";
const NAMESPACE = "fleethq:embed";

interface OpenInlineParams extends Partial<BuildBookingUrlParams> {
  anchor: Element;
  target?: Element | null;
  title?: string;
  /** Explicit URL to load instead of building one from BuildBookingUrlParams. */
  url?: string;
  /** CSS selector for the mount target, saved with the session so we can
   *  re-open at the same spot after a page reload. */
  targetSelector?: string | null;
  /** If true, do not save the session — used when auto-restoring so we
   *  don't rewrite an identical entry. */
  skipSessionSave?: boolean;
}

let activeContainer: HTMLElement | null = null;

const injectStylesheet = (): void => {
  if (document.getElementById("fhq-inline-styles")) return;
  const style = document.createElement("style");
  style.id = "fhq-inline-styles";
  style.textContent = `
    .${CONTAINER_CLASS} {
      margin: 32px 0;
      background: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04), 0 20px 40px -12px rgba(15, 23, 42, 0.12);
      animation: fhq-slide-in 260ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    .${CONTAINER_CLASS}__bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      background: #ffffff;
      border-bottom: 1px solid rgba(15, 23, 42, 0.05);
    }
    .${CONTAINER_CLASS}__title {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.02em;
      line-height: 1.2;
    }
    .${CONTAINER_CLASS}__close {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 14px;
      border-radius: 10px;
      border: 0;
      background: rgba(15, 23, 42, 0.04);
      color: #0f172a;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 140ms ease, transform 140ms ease;
      font-family: inherit;
    }
    .${CONTAINER_CLASS}__close:hover { background: rgba(15, 23, 42, 0.08); transform: translateX(-1px); }
    .${CONTAINER_CLASS}__close svg { width: 14px; height: 14px; }
    .${CONTAINER_CLASS}__loading {
      padding: 56px 24px;
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
      from { transform: translateY(12px); opacity: 0; }
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
  const {
    anchor,
    target,
    title = "Reserve your rental",
    url: explicitUrl,
    targetSelector,
    skipSessionSave,
    ...urlParams
  } = params;

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
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.innerHTML =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3.5 5.5 8l4.5 4.5"/></svg><span>Back</span>';
  closeBtn.addEventListener("click", () => {
    dispatch(anchor, "fleethq:checkout-closed", { reason: "user" });
    clearSession();
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

  if (!skipSessionSave) {
    saveSession({
      url,
      mode: "inline",
      title,
      targetSelector: targetSelector ?? null,
      tenant: urlParams.tenant ?? null,
    });
  }

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
      case "navigate":
        // Iframe navigated to a new URL (booking success page, verify
        // flow etc.). Update the saved session so a reload picks up the
        // latest step instead of restarting from the checkout form.
        saveSession({
          url: payload.url,
          mode: "inline",
          title,
          targetSelector: targetSelector ?? null,
          tenant: urlParams.tenant ?? null,
        });
        break;
      case "booking-complete":
        dispatch(anchor, "fleethq:checkout-complete", payload);
        window.removeEventListener("message", messageHandler);
        clearSession();
        removeActive();
        break;
      case "booking-error":
        dispatch(anchor, "fleethq:checkout-error", payload);
        break;
      case "close":
        window.removeEventListener("message", messageHandler);
        clearSession();
        removeActive();
        break;
      case "handoff":
        clearSession();
        window.location.href = payload.url;
        break;
      default:
        break;
    }
  };

  window.addEventListener("message", messageHandler);
};
