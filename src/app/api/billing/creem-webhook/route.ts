import { NextResponse } from "next/server";

import { grantImageCreditsPack } from "@/lib/ai-image-credits";
import {
  type CreemWebhookEvent,
  getCreemWebhookSecret,
  parseCreemGrantIntent,
  verifyCreemSignature,
} from "@/lib/creem-webhook";
import { grantPlusMembership } from "@/lib/plus-membership-grant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Creem 付款成功 → 自动开通 Plus / 加量包（在 Creem Dashboard → Webhook 填此 URL） */
export async function POST(req: Request) {
  const secret = getCreemWebhookSecret();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "creem_webhook_not_configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("creem-signature") ?? req.headers.get("Creem-Signature");
  if (!verifyCreemSignature(rawBody, signature, secret)) {
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  let payload: CreemWebhookEvent;
  try {
    payload = JSON.parse(rawBody) as CreemWebhookEvent;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const intent = parseCreemGrantIntent(payload);
  if (!intent) {
    return NextResponse.json({ ok: true, skipped: true, eventType: payload.eventType ?? null });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "service_role_missing" }, { status: 503 });
  }

  const provider = "creem";

  if (intent.kind === "plus") {
    const result = await grantPlusMembership({
      admin,
      userId: intent.userId,
      planId: intent.planId,
      provider,
      externalOrderId: intent.externalOrderId,
    });
    if (!result.granted) {
      const status = result.reason === "duplicate_order" ? 200 : 500;
      return NextResponse.json({ ok: result.granted, reason: result.reason }, { status });
    }
    return NextResponse.json({ ok: true, kind: "plus", plan_id: intent.planId, user_id: intent.userId });
  }

  const result = await grantImageCreditsPack({
    admin,
    userId: intent.userId,
    packId: intent.packId,
    provider,
    externalOrderId: intent.externalOrderId,
  });
  if (!result.granted) {
    const status = result.reason === "duplicate_order" ? 200 : 500;
    return NextResponse.json({ ok: result.granted, reason: result.reason }, { status });
  }
  return NextResponse.json({ ok: true, kind: "pack", pack_id: intent.packId, user_id: intent.userId });
}
