import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function parseISODate(value: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    // throws RangeError for invalid IANA zone
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function isoDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;

  if (!y || !m || !d) throw new Error("Failed to resolve date parts");
  return `${y}-${m}-${d}`;
}

function isoDateMinusDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 503 });
  }
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    // 该端点会在客户端启动时被调用；未登录时视为“无需生成通知”（避免控制台出现 401 噪音）。
    return NextResponse.json({ ok: true, created: false, skipped: "unauthenticated" }, { status: 200 });
  }

  const body = (await req.json().catch(() => null)) as null | { today?: string; timeZone?: string };
  const tz = isValidTimeZone(body?.timeZone) ? body!.timeZone! : null;
  const today = tz ? isoDateInTimeZone(new Date(), tz) : parseISODate(body?.today ?? null);
  if (!today) return NextResponse.json({ ok: false, error: "invalid_today" }, { status: 400 });

  const target = isoDateMinusDays(today, 1);

  // 优先使用 occurred_on（date）判断；若数据库未更新该字段，则降级用 timestamp 做范围判断
  let count: number | null = null;
  const { count: countByDate, error: byDateError } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user.id)
    .eq("occurred_on", target);

  if (!byDateError) {
    count = countByDate ?? 0;
  } else {
    const start = `${target}T00:00:00.000Z`;
    const end = `${isoDateMinusDays(target, -1)}T00:00:00.000Z`;
    const { count: countByTs, error: byTsError } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.user.id)
      .gte("timestamp", start)
      .lt("timestamp", end);

    if (byTsError) {
      return NextResponse.json({ ok: false, error: "transactions_query_failed" }, { status: 500 });
    }
    count = countByTs ?? 0;
  }

  if ((count ?? 0) > 0) {
    return NextResponse.json({ ok: true, created: false, reason: "has_transactions" });
  }

  const title = "昨日未记账";
  const bodyText = "去补录一笔吧。";

  const { error: insertError } = await supabase.from("notifications").insert({
    user_id: auth.user.id,
    kind: "missing_ledger",
    for_date: target,
    title,
    body: bodyText,
  });

  // 如果是唯一约束冲突（重复创建），直接视为成功
  if (insertError && insertError.code !== "23505") {
    return NextResponse.json({ ok: false, error: "notifications_insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, created: !insertError });
}

