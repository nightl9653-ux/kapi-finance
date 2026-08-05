import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * 批量关闭已过期 Plus。
 * - Vercel Cron：每天 GET（自动带 Authorization: Bearer $CRON_SECRET）
 * - 手动 / 外部：POST，Bearer $CRON_SECRET 或 $BILLING_WEBHOOK_SECRET
 */
async function revokeExpiredPlus(req: Request) {
  const secret =
    process.env.CRON_SECRET?.trim() || process.env.BILLING_WEBHOOK_SECRET?.trim() || "";
  if (!secret) {
    return NextResponse.json({ ok: false, error: "cron_not_configured" }, { status: 503 });
  }

  const auth = req.headers.get("authorization")?.trim() ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "service_role_missing" }, { status: 503 });
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await admin
    .from("profiles")
    .update({ is_plus_member: false })
    .eq("is_plus_member", true)
    .not("plus_expires_at", "is", null)
    .lte("plus_expires_at", nowIso)
    .select("id");

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, revoked: data?.length ?? 0 });
}

export async function GET(req: Request) {
  return revokeExpiredPlus(req);
}

export async function POST(req: Request) {
  return revokeExpiredPlus(req);
}
