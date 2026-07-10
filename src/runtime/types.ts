export interface TenantConfig {
  id: number;
  slug: string;
  name: string;
  timezone: string;
  currency: string;
  checkout_base_url: string;
  theme: ThemeTokens;
  branding: BrandingTokens;
  features: FeatureFlags;
}

export interface ThemeTokens {
  primary_color: string;
  primary_hover_color: string | null;
  secondary_color: string;
  accent_color: string | null;
  font_family: string | null;
  radius: string;
}

export interface BrandingTokens {
  logo_url: string | null;
  display_name: string;
}

export interface FeatureFlags {
  checkout: "redirect" | "iframe";
  search: boolean;
  manual_insurance: boolean;
}

export interface FleetImage {
  id: number;
  url: string | null;
}

export interface FleetSummary {
  id: number;
  name: string;
  year: string;
  make: string;
  model: string;
  seats: number;
  doors: number;
  transmission: string;
  fuel_type: string;
  fleet_class: { id: number; name: string } | null;
  hero_image: string | null;
  price_per_day: number | null;
  price_per_hour: number | null;
}

export interface FleetDetail extends FleetSummary {
  description: string | null;
  images: FleetImage[];
  features: { id: number; name: string }[];
}

export interface Paginated<T> {
  results: T[];
  count?: number;
  next?: string | null;
  previous?: string | null;
}

export interface FleetListParams {
  q?: string;
  fleet_class?: string | number;
  seats_min?: number;
  transmission?: string;
  location?: number;
  pickup?: string;
  dropoff?: string;
  page?: number;
  page_size?: number;
}

export interface EmbedGlobal {
  init(options?: EmbedInitOptions): void;
  getConfig(tenant?: string): Promise<TenantConfig>;
  buildBookingUrl(params: BuildBookingUrlParams): Promise<string>;
  openCheckout(params: BuildBookingUrlParams): Promise<{ reason: string }>;
}

export interface EmbedInitOptions {
  apiBase?: string;
  tenant?: string;
}

export interface BuildBookingUrlParams {
  fleetId: number;
  pickup?: string;
  dropoff?: string;
  locationId?: number;
  tenant?: string;
}

declare global {
  interface Window {
    FleetHQEmbed?: EmbedGlobal;
  }
}
