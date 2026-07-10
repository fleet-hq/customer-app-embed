import { loadTenantConfig } from "./tenant";
import type { BuildBookingUrlParams } from "./types";

const splitIso = (raw: string): { date: string; time: string } | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const [datePart, timePartRaw] = trimmed.split("T");
  if (!datePart || !timePartRaw) return null;
  const timePart = timePartRaw.slice(0, 5);
  return { date: datePart, time: timePart };
};

export const buildBookingUrl = async ({
  fleetId,
  pickup,
  dropoff,
  locationId,
  tenant,
}: BuildBookingUrlParams): Promise<string> => {
  const config = await loadTenantConfig(tenant);
  const base = config.checkout_base_url || `https://${config.slug}`;
  const url = new URL(`${base.replace(/\/$/, "")}/checkout/${fleetId}`);

  if (pickup) {
    const parts = splitIso(pickup);
    if (parts) {
      url.searchParams.set("pickupDate", parts.date);
      url.searchParams.set("pickupTime", parts.time);
    }
  }
  if (dropoff) {
    const parts = splitIso(dropoff);
    if (parts) {
      url.searchParams.set("returnDate", parts.date);
      url.searchParams.set("returnTime", parts.time);
    }
  }
  if (locationId) {
    url.searchParams.set("pickupLocId", String(locationId));
    url.searchParams.set("dropoffLocId", String(locationId));
  }

  // Always carry the tenant slug in the URL so a shared FleetHQ hosted
  // checkout (fleethq-book.vercel.app) can identify the tenant without
  // relying on the Host header. Tenants using their own aliased
  // customer-central deployment still receive the param; their central
  // treats a matching Host as the source of truth and safely ignores it.
  url.searchParams.set("tenant", config.slug);

  url.searchParams.set("utm_source", "fleethq_embed");
  url.searchParams.set("utm_medium", "widget");
  return url.toString();
};
