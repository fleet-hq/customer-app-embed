import type { ThemeTokens } from "./types";

export const themeToCssVars = (theme: ThemeTokens): Record<string, string> => {
  const vars: Record<string, string> = {
    "--fhq-color-primary": theme.primary_color,
    "--fhq-color-secondary": theme.secondary_color,
    "--fhq-radius": theme.radius || "12px",
  };
  if (theme.primary_hover_color) vars["--fhq-color-primary-hover"] = theme.primary_hover_color;
  if (theme.accent_color) vars["--fhq-color-accent"] = theme.accent_color;
  if (theme.font_family) vars["--fhq-font-family"] = theme.font_family;
  return vars;
};

export const applyThemeToHost = (host: HTMLElement, theme: ThemeTokens): void => {
  for (const [name, value] of Object.entries(themeToCssVars(theme))) {
    host.style.setProperty(name, value);
  }
};

export const formatCurrency = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (currency || "USD").toUpperCase(),
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency.toUpperCase()} ${amount.toFixed(0)}`;
  }
};
