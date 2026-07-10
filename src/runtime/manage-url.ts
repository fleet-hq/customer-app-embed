import { loadTenantConfig } from "./tenant";

interface BuildManageUrlParams {
  tenant?: string | null;
}

export const buildManageUrl = async ({ tenant }: BuildManageUrlParams): Promise<string> => {
  const config = await loadTenantConfig(tenant);
  const base = config.checkout_base_url || `https://${config.slug}`;
  const url = new URL(`${base.replace(/\/$/, "")}/manage`);
  url.searchParams.set("tenant", config.slug);
  url.searchParams.set("utm_source", "fleethq_embed");
  url.searchParams.set("utm_medium", "widget");
  return url.toString();
};
