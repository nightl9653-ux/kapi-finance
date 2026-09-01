import { NextResponse } from "next/server";

import { parseArtPostId } from "@/lib/art-board";
import { resolveArtReturnUrl } from "@/lib/art-tip-checkout";
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
 * 艺术站出钱会带 art=1，校验来源后跳回艺术站。
 */
export async function GET(req: Request) {
  const incoming = new URL(req.url);
  if (incoming.searchParams.get("art") === "1") {
    const postId = parseArtPostId(incoming.searchParams.get("post"));
    const dest = resolveArtReturnUrl(incoming.searchParams.get("return_origin"), postId);
    return NextResponse.redirect(dest);
  }

  const localeParam = incoming.searchParams.get("locale");
  const locale = localeParam ? parseBillingLocale(localeParam) : billingLocaleFromRequest(req);
  const dest = new URL(pricingCheckoutSuccessPath(locale), billingRequestOrigin(req));

  for (const key of CREEM_REDIRECT_PARAMS) {
    const value = incoming.searchParams.get(key);
    if (value) dest.searchParams.set(key, value);
  }

  return NextResponse.redirect(dest);
}
