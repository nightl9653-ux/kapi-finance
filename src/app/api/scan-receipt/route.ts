import { NextResponse } from "next/server";

import { getOpenAIScanConfig, isSupabaseConfigured, scanOcrProvider, scanReceiptDailyLimit } from "@/lib/env";
import { extractTransactionsFromImage } from "@/lib/scan-receipt-ai";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 120;

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function parseUsageDate(raw: FormData): string {
  const v = String(raw.get("usage_date") ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return new Date().toISOString().slice(0, 10);
}

function parseLocale(raw: FormData): string {
  return String(raw.get("locale") ?? "en").trim() || "en";
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 503 });
  }

  const openai = scanOcrProvider === "openai" ? getOpenAIScanConfig() : null;
  if (scanOcrProvider === "openai" && !openai) {
    return NextResponse.json({ ok: false, error: "openai_unconfigured" }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json({ ok: false, error: "bad_file" }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_file" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "bad_file" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "file_too_large" }, { status: 413 });
  }

  const mime = (file.type || "application/octet-stream").toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json({ ok: false, error: "unsupported_type" }, { status: 400 });
  }

  const usageDate = parseUsageDate(formData);
  const locale = parseLocale(formData);

  const { data: usageRow, error: usageErr } = await supabase
    .from("ai_usage")
    .select("id, screenshot_count")
    .eq("user_id", auth.user.id)
    .eq("date", usageDate)
    .maybeSingle();

  if (usageErr) {
    return NextResponse.json({ ok: false, error: "usage_query_failed" }, { status: 500 });
  }

  const used = usageRow?.screenshot_count ?? 0;
  if (used >= scanReceiptDailyLimit) {
    return NextResponse.json(
      { ok: false, error: "rate_limit", limit: scanReceiptDailyLimit },
      { status: 429 },
    );
  }

  let buf: ArrayBuffer;
  try {
    buf = await file.arrayBuffer();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_file" }, { status: 400 });
  }

  const base64 = Buffer.from(buf).toString("base64");

  let extracted: Awaited<ReturnType<typeof extractTransactionsFromImage>>;
  try {
    if (scanOcrProvider === "tesseract") {
      return NextResponse.json({ ok: false, error: "ocr_provider_unavailable" }, { status: 503 });
    }

    extracted = await extractTransactionsFromImage({
      apiKey: openai!.apiKey,
      model: openai!.model,
      baseURL: openai!.baseURL,
      base64,
      mimeType: mime,
      locale,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (
      msg === "empty_completion" ||
      msg === "invalid_json" ||
      msg === "schema_mismatch" ||
      msg === "no_transactions"
    ) {
      if (msg === "no_transactions") {
        // 识别链路正常但未提取到任何交易：用 200 返回空数组，避免在 Network 里表现为“错误请求”。
        // 同时不写入 ai_usage（不消耗额度），保持“只对成功识别计数”的现有策略。
        return NextResponse.json({
          ok: true,
          transactions: [],
          remaining: Math.max(0, scanReceiptDailyLimit - used),
          limit: scanReceiptDailyLimit,
        });
      }
      console.warn("scan-receipt unrecognized", {
        provider: scanOcrProvider,
        reason: msg,
        mime,
        bytes: file.size,
        locale,
      });
      return NextResponse.json(
        { ok: false, error: "unrecognized", reason: msg, provider: scanOcrProvider },
        { status: 422 },
      );
    }
    console.error(`scan-receipt ${scanOcrProvider}`, e);
    return NextResponse.json(
      { ok: false, error: "openai_failed" },
      { status: 502 },
    );
  }

  const nextCount = used + 1;
  if (!usageRow?.id) {
    const { error: insErr } = await supabase.from("ai_usage").insert({
      user_id: auth.user.id,
      date: usageDate,
      screenshot_count: nextCount,
    });
    if (insErr) {
      console.error("ai_usage insert", insErr);
      return NextResponse.json({ ok: false, error: "usage_write_failed" }, { status: 500 });
    }
  } else {
    const { error: upErr } = await supabase
      .from("ai_usage")
      .update({ screenshot_count: nextCount })
      .eq("id", usageRow.id)
      .eq("user_id", auth.user.id);
    if (upErr) {
      console.error("ai_usage update", upErr);
      return NextResponse.json({ ok: false, error: "usage_write_failed" }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    transactions: extracted.rows,
    remaining: Math.max(0, scanReceiptDailyLimit - nextCount),
    limit: scanReceiptDailyLimit,
  });
}
