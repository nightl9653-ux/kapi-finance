import OpenAI from "openai";
import { NextResponse } from "next/server";

import { buildAssistantContextBlock } from "@/lib/ai-assistant-user-context";
import { getAiUsageLimit } from "@/lib/ai-usage-limits";
import { getOpenAIChatConfig, isSupabaseConfigured } from "@/lib/env";
import { fetchUserIsPlusMember } from "@/lib/user-plus-membership";
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
      "你是「咔皮·家庭财务规划」（Kapi Finance）应用内的 AI 助手，不是泛泛的理财科普作者。",
      "请用简体中文回复，语气像可信的朋友：直接、少形容词，避免「众所周知」「首先要树立正确的理财观」这类空话。",
      "每次回复应优先利用下方【咔皮已知的简要画像】：至少点名其中 1～2 条（例如目标名称、支出大类、本月预算各行的「上限 vs 本月已记支出」）来组织建议；若无画像数据再追问用户一个关键数字或场景。",
      "严禁写成「省钱四大法则」「通用记账步骤」那种列表鸡汤；若列点，每点应对应用户的具体问题或画像里的一类事实。",
      "可适当指路应用内能力：如「AI 预算方案」「目标管理」「记账/报表」里用户下一步可以做什么（一句话即可）。",
      "不要编造用户的具体账户余额或未出现的交易；需要精确数字时请用户看应用或自行补充。",
      "不要给出个股/加密货币买卖建议或法律税务结论；必要时建议咨询专业人士。",
      "篇幅适中：优先给可执行的两三步，不要长篇教材。",
    ].join("\n");
  }
  return [
    "You are the in-app assistant for Kapi Finance (household/personal finance)—not a generic finance blogger.",
    "Reply in clear English unless the user writes otherwise; tone is direct and practical, not motivational poster.",
    "Use the Kapi snapshot block below: tie at least 1–2 concrete items (goals, top categories, monthly budget lines showing cap vs spent) into your answer before falling back to generic guidance.",
    "Avoid hollow listicles ('top 10 saving tips'); each bullet should map to the user's question or their snapshot.",
    "You may briefly point to in-app areas: AI budget plan, goals, transactions/reports.",
    "Do not invent balances or transactions; ask the user to check the app when precision matters.",
    "No personalized trading picks or legal/tax determinations; defer to professionals when needed.",
    "Keep it concise: prefer 2–3 actionable steps over a long essay.",
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
  const isPlus = await fetchUserIsPlusMember(supabase, auth.user.id);
  const assistantLimit = getAiUsageLimit(isPlus, "assistant");

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
  if (used >= assistantLimit) {
    return NextResponse.json(
      { ok: false, error: "rate_limit", limit: assistantLimit },
      { status: 429 },
    );
  }

  const loc = locale === "zh" ? "zh" : "en";
  const baseSystem = buildSystemPrompt(loc);
  let contextBlock = "";
  try {
    contextBlock = await buildAssistantContextBlock(supabase, auth.user.id, loc);
  } catch (e) {
    console.error("ai-assistant context", e);
  }
  const system = contextBlock ? `${baseSystem}\n\n${contextBlock}` : baseSystem;
  const openai = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL, timeout: 55_000 });

  let reply: string;
  try {
    const completion = await openai.chat.completions.create({
      model: cfg.model,
      messages: [{ role: "system", content: system }, ...messages],
      temperature: 0.55,
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
    remaining: Math.max(0, assistantLimit - nextCount),
    limit: assistantLimit,
  });
}
