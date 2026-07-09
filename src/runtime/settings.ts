const DEFAULT_API_BASE = "https://backend.fleethq.io";
const DEV_API_BASE = "https://backend-dev.fleethq.io";
const LOCAL_API_BASE = "http://localhost:8000";

const SCRIPT_ATTR_API = "data-fleethq-api";
const SCRIPT_ATTR_TENANT = "data-fleethq-tenant";

interface EmbedSettings {
  apiBase: string;
  defaultTenant: string | null;
}

let cached: EmbedSettings | null = null;

const readScriptAttr = (attr: string): string | null => {
  if (typeof document === "undefined") return null;
  const nodes = document.querySelectorAll<HTMLScriptElement>(`script[${attr}]`);
  for (const node of Array.from(nodes)) {
    const value = node.getAttribute(attr);
    if (value) return value.trim();
  }
  return null;
};

const inferApiBase = (): string => {
  if (typeof window === "undefined") return DEFAULT_API_BASE;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return LOCAL_API_BASE;
  if (host.endsWith(".dev.fleethq.io") || host.endsWith(".vercel.app")) {
    return DEV_API_BASE;
  }
  return DEFAULT_API_BASE;
};

export const readSettings = (): EmbedSettings => {
  if (cached) return cached;
  const apiBase = (readScriptAttr(SCRIPT_ATTR_API) || inferApiBase()).replace(/\/$/, "");
  const defaultTenant = readScriptAttr(SCRIPT_ATTR_TENANT);
  cached = { apiBase, defaultTenant };
  return cached;
};

export const overrideSettings = (patch: Partial<EmbedSettings>): void => {
  const base = readSettings();
  cached = {
    apiBase: (patch.apiBase ?? base.apiBase).replace(/\/$/, ""),
    defaultTenant: patch.defaultTenant ?? base.defaultTenant,
  };
};

export const resetSettings = (): void => {
  cached = null;
};
