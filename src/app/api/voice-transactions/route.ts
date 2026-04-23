import OpenAI from "openai";
import { NextResponse } from "next/server";

import { getOpenAIScanConfig, isSupabaseConfigured, voiceDailyLimit } from "@/lib/env";
import { extractTransactionsFromText } from "@/lib/scan-receipt-ai";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 120;

const MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/wav",
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/x-m4a",
]);

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

  const openai = getOpenAIScanConfig();
  if (!openai) {
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

  const mimeRaw = (file.type || "application/octet-stream").toLowerCase();
  const mime = mimeRaw.split(";", 1)[0]?.trim() || mimeRaw;
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json({ ok: false, error: "unsupported_type" }, { status: 400 });
  }

  const usageDate = parseUsageDate(formData);
  const locale = parseLocale(formData);

  const { data: usageRow, error: usageErr } = await supabase
    .from("ai_usage")
    .select("id, voice_count")
    .eq("user_id", auth.user.id)
    .eq("date", usageDate)
    .maybeSingle();

  if (usageErr) {
    return NextResponse.json({ ok: false, error: "usage_query_failed" }, { status: 500 });
  }

  const used = usageRow?.voice_count ?? 0;
  if (used >= voiceDailyLimit) {
    return NextResponse.json(
      { ok: false, error: "rate_limit", limit: voiceDailyLimit },
      { status: 429 },
    );
  }

  let transcriptText: string;
  try {
    const client = new OpenAI({ apiKey: openai.apiKey, baseURL: openai.baseURL, timeout: 90_000 });
    const tr = await client.audio.transcriptions.create({
      file,
      model: openai.transcribeModel,
      language: locale.toLowerCase().startsWith("zh") ? "zh" : "en",
    });
    transcriptText = String((tr as { text?: unknown }).text ?? "").trim();
    if (!transcriptText) return NextResponse.json({ ok: false, error: "unrecognized" }, { status: 422 });
  } catch (e) {
    console.error("voice-transcribe openai", e);
    return NextResponse.json({ ok: false, error: "openai_failed" }, { status: 502 });
  }

  let extracted: Awaited<ReturnType<typeof extractTransactionsFromText>>;
  try {
    extracted = await extractTransactionsFromText({
      apiKey: openai.apiKey,
      model: openai.model,
      baseURL: openai.baseURL,
      text: transcriptText,
      locale,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "empty_completion" || msg === "invalid_json" || msg === "schema_mismatch") {
      return NextResponse.json({ ok: false, error: "unrecognized" }, { status: 422 });
    }
    console.error("voice-parse openai", e);
    return NextResponse.json({ ok: false, error: "openai_failed" }, { status: 502 });
  }

  const nextCount = used + 1;
  if (!usageRow?.id) {
    const { error: insErr } = await supabase.from("ai_usage").insert({
      user_id: auth.user.id,
      date: usageDate,
      screenshot_count: 0,
      voice_count: nextCount,
    });
    if (insErr) {
      console.error("ai_usage insert", insErr);
      return NextResponse.json({ ok: false, error: "usage_write_failed" }, { status: 500 });
    }
  } else {
    const { error: upErr } = await supabase
      .from("ai_usage")
      .update({ voice_count: nextCount })
      .eq("id", usageRow.id)
      .eq("user_id", auth.user.id);
    if (upErr) {
      console.error("ai_usage update", upErr);
      return NextResponse.json({ ok: false, error: "usage_write_failed" }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    transcript: transcriptText,
    transactions: extracted.rows,
    remaining: Math.max(0, voiceDailyLimit - nextCount),
    limit: voiceDailyLimit,
  });
}

