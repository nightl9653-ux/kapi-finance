import {
  ART_TIP_MAX_UNITS,
  ART_TIP_UNIT_PRICE_USD,
  artTipAmountUsd,
  getArtTipProductId,
  parseArtPostId,
  parseArtTipUnits,
} from "@/lib/art-board";
import { getArtPublicUrl, parseAllowedArtOrigin } from "@/lib/art-origins";
import { createCreemCheckout, isCreemCheckoutApiConfigured } from "@/lib/creem-checkout";

export function isArtTipCheckoutConfigured(): boolean {
  return Boolean(getArtTipProductId()) && isCreemCheckoutApiConfigured();
}

export function artTipCheckoutSummary() {
  return {
    unit_price_usd: ART_TIP_UNIT_PRICE_USD,
    min_units: 1,
    max_units: ART_TIP_MAX_UNITS,
    checkout_configured: isArtTipCheckoutConfigured(),
  };
}

export function artCheckoutReturnPath(postId: string, returnOrigin?: string | null): string {
  const u = new URL("/api/billing/checkout-return", "https://placeholder.local");
  u.searchParams.set("art", "1");
  u.searchParams.set("post", postId);
  if (returnOrigin) u.searchParams.set("return_origin", returnOrigin);
  return `${u.pathname}${u.search}`;
}

export function artCheckoutSuccessUrl(kapiOrigin: string, postId: string, returnOrigin?: string | null): string {
  return new URL(artCheckoutReturnPath(postId, returnOrigin), kapiOrigin).href;
}

export function resolveArtReturnUrl(returnOrigin: string | null | undefined, postId: string | null): string {
  const origin = parseAllowedArtOrigin(returnOrigin) ?? getArtPublicUrl();
  const dest = new URL("/", origin);
  dest.searchParams.set("paid", "1");
  if (postId) dest.searchParams.set("post", postId);
  return dest.href;
}

async function artSitePostExists(artOrigin: string, postId: string): Promise<"ok" | "missing" | "error"> {
  try {
    const res = await fetch(new URL(`/api/posts/${postId}`, artOrigin).href, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (res.status === 404) return "missing";
    if (!res.ok) return "error";
    const json = (await res.json()) as { ok?: boolean; post?: { id?: string } };
    if (json?.ok && json.post?.id) return "ok";
    return "missing";
  } catch {
    return "error";
  }
}

export async function createArtTipCheckout(params: {
  postId: string;
  units: number;
  kapiOrigin: string;
  returnOrigin?: string | null;
  artUserId?: string | null;
  payerEmail?: string | null;
}): Promise<
  | { ok: true; checkout_url: string; units: number; amount_usd: number; post_id: string }
  | { ok: false; error: string }
> {
  const postId = parseArtPostId(params.postId);
  const units = parseArtTipUnits(params.units);
  if (!postId) return { ok: false, error: "invalid_post" };
  if (!units) return { ok: false, error: "invalid_units" };

  const productId = getArtTipProductId();
  if (!productId || !isCreemCheckoutApiConfigured()) {
    return { ok: false, error: "checkout_not_configured" };
  }

  const returnOrigin = parseAllowedArtOrigin(params.returnOrigin) ?? getArtPublicUrl();
  const lookupOrigin = getArtPublicUrl();
  let exists = await artSitePostExists(lookupOrigin, postId);
  if (exists !== "ok" && returnOrigin !== lookupOrigin) {
    exists = await artSitePostExists(returnOrigin, postId);
  }
  if (exists === "error") return { ok: false, error: "post_lookup_failed" };
  if (exists === "missing") return { ok: false, error: "post_not_found" };

  const artUserId = parseArtPostId(params.artUserId) ?? "";
  const successUrl = artCheckoutSuccessUrl(params.kapiOrigin, postId, returnOrigin);
  const session = await createCreemCheckout({
    productId,
    units,
    successUrl,
    requestId: `art:${postId}:${artUserId || "anon"}:${Date.now()}`,
    customerEmail: params.payerEmail?.trim() || undefined,
    metadata: {
      kind: "art_tip",
      post_id: postId,
      units: String(units),
      ...(artUserId ? { art_user_id: artUserId } : {}),
    },
  });

  if (!session.ok) return { ok: false, error: session.error };
  return {
    ok: true,
    checkout_url: session.checkoutUrl,
    units,
    amount_usd: artTipAmountUsd(units),
    post_id: postId,
  };
}
