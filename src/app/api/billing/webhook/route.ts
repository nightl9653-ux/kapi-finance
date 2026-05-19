import { NextResponse } from "next/server";

import { grantImageCreditsPack } from "@/lib/ai-image-credits";
import { type CreditPackId, getCreditPack } from "@/lib/credit-packs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type WebhookGrantBody = {
  user_id?: string;
  pack_id?: string;
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
  const packId = String(body.pack_id ?? "").trim() as CreditPackId;
  const provider = String(body.provider ?? "manual").trim() || "manual";
  const externalOrderId = String(body.external_order_id ?? "").trim();

  if (!userId || !externalOrderId || !getCreditPack(packId)) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "service_role_missing" }, { status: 503 });
  }

  const result = await grantImageCreditsPack({
    admin,
    userId,
    packId,
    provider,
    externalOrderId,
  });

  if (!result.granted) {
    const status = result.reason === "duplicate_order" ? 200 : 500;
    return NextResponse.json({ ok: result.granted, reason: result.reason }, { status });
  }

  return NextResponse.json({ ok: true, pack_id: packId, user_id: userId });
}
