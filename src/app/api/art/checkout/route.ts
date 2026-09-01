import { artJson, artOptions } from "@/lib/art-api";
import { parseArtPostId, parseArtTipUnits } from "@/lib/art-board";
import { artTipCheckoutSummary, createArtTipCheckout } from "@/lib/art-tip-checkout";
import { getArtGrantSecret, verifyArtSiteSecret } from "@/lib/art-site-secret";
import { billingRequestOrigin } from "@/lib/billing-request";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return artOptions(req);
}

export async function GET(req: Request) {
  return artJson(req, { ok: true, ...artTipCheckoutSummary() });
}

type CheckoutBody = {
  post_id?: string;
  units?: number | string;
  return_origin?: string;
  art_user_id?: string;
  email?: string;
};

export async function POST(req: Request) {
  if (!getArtGrantSecret()) {
    return artJson(req, { ok: false, error: "grant_not_configured" }, 503);
  }
  if (!verifyArtSiteSecret(req.headers.get("authorization"))) {
    return artJson(req, { ok: false, error: "unauthorized" }, 401);
  }

  let body: CheckoutBody;
  try {
    body = (await req.json()) as CheckoutBody;
  } catch {
    return artJson(req, { ok: false, error: "invalid_json" }, 400);
  }

  const postId = parseArtPostId(body.post_id);
  const units = parseArtTipUnits(body.units);
  if (!postId) return artJson(req, { ok: false, error: "invalid_post" }, 400);
  if (!units) return artJson(req, { ok: false, error: "invalid_units" }, 400);

  const result = await createArtTipCheckout({
    postId,
    units,
    kapiOrigin: billingRequestOrigin(req),
    returnOrigin: body.return_origin,
    artUserId: body.art_user_id,
    payerEmail: body.email,
  });

  if (!result.ok) {
    const status =
      result.error === "post_not_found"
        ? 404
        : result.error === "checkout_not_configured" || result.error === "post_lookup_failed"
          ? 503
          : 400;
    return artJson(req, { ok: false, error: result.error }, status);
  }

  return artJson(req, result);
}
