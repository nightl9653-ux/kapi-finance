import { NextResponse } from "next/server";

import { billingLocaleFromRequest, billingRequestOrigin } from "@/lib/billing-request";
import { parseBillingLocale, pricingCheckoutSuccessPath } from "@/lib/billing-success-url";

export const runtime = "nodejs";

const CREEM_REDIRECT_PARAMS = [
  "checkout_id",
  "order_id",
  "subscription_id",
  "customer_id",
  "product_id",
  "request_id",
  "signature",
] as const;

/**
 * Creem 商品「返回网址」兜底：付完款先到这里，再按 locale 跳到 /{locale}/pricing。
 * 从咔账定价页发起的结账会在链接里带 success_url，一般不经此路由。
 */
export async function GET(req: Request) {
  const incoming = new URL(req.url);
  const localeParam = incoming.searchParams.get("locale");
  const locale = localeParam ? parseBillingLocale(localeParam) : billingLocaleFromRequest(req);
  const dest = new URL(pricingCheckoutSuccessPath(locale), billingRequestOrigin(req));

  for (const key of CREEM_REDIRECT_PARAMS) {
    const value = incoming.searchParams.get(key);
    if (value) dest.searchParams.set(key, value);
  }

  return NextResponse.redirect(dest);
}
