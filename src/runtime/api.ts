import { readSettings } from "./settings";
import type {
  FleetDetail,
  FleetListParams,
  FleetSummary,
  Paginated,
  TenantConfig,
} from "./types";

export class EmbedApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message || `Embed API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

const buildUrl = (path: string, params: Record<string, string | number | undefined | null> = {}): string => {
  const { apiBase } = readSettings();
  const url = new URL(`${apiBase}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
};

const request = async <T>(url: string, init: RequestInit = {}): Promise<T> => {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  headers.set("X-FleetHQ-Embed", __EMBED_VERSION__);
  const response = await fetch(url, { ...init, headers, credentials: "omit", mode: "cors" });
  let body: unknown = null;
  const raw = await response.text();
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
  }
  if (!response.ok) throw new EmbedApiError(response.status, body);
  return body as T;
};

const tenantParam = (tenant: string): { tenant: string } => ({ tenant });

export const fetchTenantConfig = (tenant: string): Promise<TenantConfig> =>
  request<TenantConfig>(buildUrl("/api/embed/tenant-resolve/", tenantParam(tenant)));

export const fetchFleets = (
  tenant: string,
  params: FleetListParams = {},
): Promise<Paginated<FleetSummary>> =>
  request<Paginated<FleetSummary>>(
    buildUrl("/api/embed/fleets/", {
      ...tenantParam(tenant),
      q: params.q,
      fleet_class: params.fleet_class,
      seats_min: params.seats_min,
      transmission: params.transmission,
      location: params.location,
      pickup_datetime: params.pickup,
      dropoff_datetime: params.dropoff,
      page: params.page,
      page_size: params.page_size,
    }),
  );

export const fetchFleetDetail = (tenant: string, fleetId: number): Promise<FleetDetail> =>
  request<FleetDetail>(buildUrl(`/api/embed/fleets/${fleetId}/`, tenantParam(tenant)));

export interface EmbedLocation {
  id: number;
  name: string;
  address: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export const fetchLocations = (tenant: string): Promise<{ results: EmbedLocation[] }> =>
  request<{ results: EmbedLocation[] }>(buildUrl("/api/embed/locations/", tenantParam(tenant)));

declare const __EMBED_VERSION__: string;
