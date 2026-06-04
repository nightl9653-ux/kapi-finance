import { parseBillingLocale } from "@/lib/billing-success-url";
import type { Locale } from "@/i18n/locales";

export function billingRequestOrigin(req: Request): string {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  if (host) return `${proto}://${host}`;
  return url.origin;
}

export function billingLocaleFromRequest(req: Request): Locale {
  const fromQuery = new URL(req.url).searchParams.get("locale");
  if (fromQuery) return parseBillingLocale(fromQuery);
  const accept = req.headers.get("accept-language") ?? "";
  if (/\bzh\b/i.test(accept) || accept.toLowerCase().includes("zh-")) return "zh";
  return "en";
}
