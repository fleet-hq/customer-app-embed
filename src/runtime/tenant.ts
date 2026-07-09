import { fetchTenantConfig } from "./api";
import { readSettings } from "./settings";
import type { TenantConfig } from "./types";

const inflight = new Map<string, Promise<TenantConfig>>();
const resolved = new Map<string, TenantConfig>();

export const resolveTenantSlug = (explicit?: string | null): string => {
  const settings = readSettings();
  const slug = (explicit && explicit.trim()) || settings.defaultTenant;
  if (!slug) throw new Error("FleetHQ embed: tenant slug is required — set tenant=\"…\" on the widget or on the script tag.");
  return slug;
};

export const loadTenantConfig = (explicit?: string | null): Promise<TenantConfig> => {
  const slug = resolveTenantSlug(explicit);
  const cached = resolved.get(slug);
  if (cached) return Promise.resolve(cached);
  const pending = inflight.get(slug);
  if (pending) return pending;
  const promise = fetchTenantConfig(slug)
    .then((config) => {
      resolved.set(slug, config);
      inflight.delete(slug);
      return config;
    })
    .catch((err) => {
      inflight.delete(slug);
      throw err;
    });
  inflight.set(slug, promise);
  return promise;
};

export const clearTenantCache = (slug?: string): void => {
  if (!slug) {
    resolved.clear();
    inflight.clear();
    return;
  }
  resolved.delete(slug);
  inflight.delete(slug);
};
