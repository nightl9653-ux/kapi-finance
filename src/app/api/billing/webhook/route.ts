import { NextResponse } from "next/server";

import { grantImageCreditsPack } from "@/lib/ai-image-credits";
import { type CreditPackId, getCreditPack } from "@/lib/credit-packs";
import { grantPlusMembership } from "@/lib/plus-membership-grant";
import { type PlusPlanId, getPlusPlan } from "@/lib/plus-plans";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type WebhookGrantBody = {
  user_id?: string;
  pack_id?: string;
  plan_id?: string;
  provider?: string;
  external_order_id?: string;
};

/** 支付平台 webhook 统一入账（Creem / Polar / Lemon Squeezy 解析后 POST 到此） */
export async function POST(req: Request) {
  const secret = process.env.BILLING_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "webhook_not_configured" }, { status: 503 });
  }

  const auth = req.headers.get("authorization")?.trim() ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: WebhookGrantBody;
  try {
    body = (await req.json()) as WebhookGrantBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const userId = String(body.user_id ?? "").trim();
  const packId = String(body.pack_id ?? "").trim();
  const planId = String(body.plan_id ?? "").trim() as PlusPlanId;
  const provider = String(body.provider ?? "manual").trim() || "manual";
  const externalOrderId = String(body.external_order_id ?? "").trim();

  if (!userId || !externalOrderId) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "service_role_missing" }, { status: 503 });
  }

  if (packId && getCreditPack(packId)) {
    const result = await grantImageCreditsPack({
      admin,
      userId,
      packId: packId as CreditPackId,
      provider,
      externalOrderId,
    });

    if (!result.granted) {
      const status = result.reason === "duplicate_order" ? 200 : 500;
      return NextResponse.json({ ok: result.granted, reason: result.reason }, { status });
    }

    return NextResponse.json({ ok: true, pack_id: packId, user_id: userId });
  }

  if (planId && getPlusPlan(planId)) {
    const result = await grantPlusMembership({
      admin,
      userId,
      planId,
      provider,
      externalOrderId,
    });

    if (!result.granted) {
      const status =
        result.reason === "duplicate_order" || result.reason === "orders_table_missing" ? 200 : 500;
      return NextResponse.json({ ok: result.granted, reason: result.reason }, { status });
    }

    return NextResponse.json({ ok: true, plan_id: planId, user_id: userId });
  }

  return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
}
