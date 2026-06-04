import type { Locale } from "@/i18n/locales";

/** 付完款后回到定价页（带 locale 前缀） */
export function pricingCheckoutSuccessPath(locale: Locale): string {
  return `/${locale}/pricing?checkout=success`;
}

export function pricingCheckoutSuccessUrl(origin: string, locale: Locale): string {
  return new URL(pricingCheckoutSuccessPath(locale), origin).href;
}

/** Creem 商品默认返回地址（无 success_url 覆盖时用，再按 locale 跳到定价页） */
export function billingCheckoutReturnUrl(origin: string, locale: Locale): string {
  const u = new URL("/api/billing/checkout-return", origin);
  u.searchParams.set("locale", locale);
  return u.href;
}

export function parseBillingLocale(value: string | null | undefined): Locale {
  return value === "zh" ? "zh" : "en";
}
