import OpenAI from "openai";
import { NextResponse } from "next/server";

import { assistantDailyLimit, getOpenAIChatConfig, isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const MAX_CLIENT_MESSAGES = 24;
const MAX_CONTENT_CHARS = 12_000;

type Role = "user" | "assistant";
type ClientMsg = { role: Role; content: string };

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildSystemPrompt(locale: string): string {
  if (locale === "zh") {
    return [
      "你是 Kapi Finance（家庭/个人财务规划）应用内的 AI 助手。",
      "请用简体中文回复，语气清晰、务实、友好。",
      "你可以帮助：预算与目标思路、记账习惯建议、储蓄/还债的一般性策略说明。",
      "不要编造用户的具体账户余额或交易明细；若需要数据，请提示用户在应用内查看或自行补充。",
      "不要给出个股/加密货币等具体投资建议或预测；避免法律与税务结论性意见，必要时建议咨询专业人士。",
      "回答尽量简洁，可分点列出；涉及金额时默认提醒以用户本位币为准。",
    ].join("\n");
  }
  return [
    "You are the in-app AI assistant for Kapi Finance, a personal/household finance app.",
    "Reply in English unless the user writes in another language—match the user's language when reasonable.",
    "You may help with budgeting mindset, savings habits, goal planning, and general debt/paydown framing.",
    "Do not invent specific balances or transactions; ask the user to check the app or provide numbers.",
    "Do not give personalized investment/trading advice or legal/tax determinations; suggest professionals when needed.",
    "Keep answers concise and structured when helpful.",
  ].join("\n");
}

function normalizeMessages(raw: unknown): ClientMsg[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ClientMsg[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") return null;
    const role = (m as { role?: unknown }).role;
    const content = (m as { content?: unknown }).content;
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string") return null;
    const trimmed = content.trim();
    if (!trimmed) return null;
    out.push({ role, content: trimmed });
  }
  if (out.length < 1 || out.length > MAX_CLIENT_MESSAGES) return null;
  if (out[out.length - 1]?.role !== "user") return null;
  let total = 0;
  for (const m of out) total += m.content.length;
  if (total > MAX_CONTENT_CHARS) return null;
  return out;
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 503 });
  }

  const cfg = getOpenAIChatConfig();
  if (!cfg) {
    return NextResponse.json({ ok: false, error: "openai_unconfigured" }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const locale = typeof (body as { locale?: unknown }).locale === "string" ? String((body as { locale: string }).locale) : "en";
  const messages = normalizeMessages((body as { messages?: unknown }).messages);
  if (!messages) {
    return NextResponse.json({ ok: false, error: "bad_messages" }, { status: 400 });
  }

  const usageDate = todayUtc();
  const { data: usageRow, error: usageErr } = await supabase
    .from("ai_usage")
    .select("id, assistant_count")
    .eq("user_id", auth.user.id)
    .eq("date", usageDate)
    .maybeSingle();

  if (usageErr) {
    return NextResponse.json({ ok: false, error: "usage_query_failed" }, { status: 500 });
  }

  const used = Number(usageRow?.assistant_count ?? 0);
  if (used >= assistantDailyLimit) {
    return NextResponse.json(
      { ok: false, error: "rate_limit", limit: assistantDailyLimit },
      { status: 429 },
    );
  }

  const system = buildSystemPrompt(locale === "zh" ? "zh" : "en");
  const openai = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL, timeout: 55_000 });

  let reply: string;
  try {
    const completion = await openai.chat.completions.create({
      model: cfg.model,
      messages: [{ role: "system", content: system }, ...messages],
      temperature: 0.65,
      max_tokens: 1800,
    });
    reply = String(completion.choices[0]?.message?.content ?? "").trim();
    if (!reply) throw new Error("empty_completion");
  } catch (e) {
    console.error("ai-assistant chat", e);
    return NextResponse.json({ ok: false, error: "openai_failed" }, { status: 502 });
  }

  const nextCount = used + 1;
  if (!usageRow?.id) {
    const { error: insErr } = await supabase.from("ai_usage").insert({
      user_id: auth.user.id,
      date: usageDate,
      assistant_count: nextCount,
    });
    if (insErr) {
      console.error("ai_usage insert assistant", insErr);
      return NextResponse.json({ ok: false, error: "usage_write_failed" }, { status: 500 });
    }
  } else {
    const { error: upErr } = await supabase
      .from("ai_usage")
      .update({ assistant_count: nextCount })
      .eq("id", usageRow.id)
      .eq("user_id", auth.user.id);
    if (upErr) {
      console.error("ai_usage update assistant", upErr);
      return NextResponse.json({ ok: false, error: "usage_write_failed" }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    message: reply,
    remaining: Math.max(0, assistantDailyLimit - nextCount),
    limit: assistantDailyLimit,
  });
}
