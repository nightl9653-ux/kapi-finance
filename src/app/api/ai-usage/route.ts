import { NextResponse } from "next/server";

import { isSupabaseConfigured, scanReceiptDailyLimit, voiceDailyLimit } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function parseUsageDate(url: URL): string {
  const v = String(url.searchParams.get("usage_date") ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  const usageDate = parseUsageDate(new URL(req.url));

  const { data: usageRow, error: usageErr } = await supabase
    .from("ai_usage")
    .select("screenshot_count, voice_count")
    .eq("user_id", auth.user.id)
    .eq("date", usageDate)
    .maybeSingle();

  if (usageErr) {
    return NextResponse.json({ ok: false, error: "usage_query_failed" }, { status: 500 });
  }

  const scanUsed = usageRow?.screenshot_count ?? 0;
  const voiceUsed = usageRow?.voice_count ?? 0;

  const scanRemaining = Math.max(0, scanReceiptDailyLimit - scanUsed);
  const voiceRemaining = Math.max(0, voiceDailyLimit - voiceUsed);

  return NextResponse.json({
    ok: true,
    usage_date: usageDate,
    scan: {
      used: scanUsed,
      remaining: scanRemaining,
      limit: scanReceiptDailyLimit,
    },
    voice: {
      used: voiceUsed,
      remaining: voiceRemaining,
      limit: voiceDailyLimit,
    },
  }, {
    headers: {
      // 仅对当前用户短缓存，防止错误重试/初始化时频繁查询
      "Cache-Control": "private, max-age=5",
      // 保险起见：确保不同 Cookie 不共用缓存
      Vary: "Cookie",
    },
  });
}

