import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  applyDerivedSavingsEmergencyLimits,
  computeMonthlyDerivedMetrics,
  recalculateBudgetItemPct,
} from "@/lib/budget-derived-limits";
import { fetchExpenseTotalsByCategory } from "@/lib/budget-progress";
import { getAiUsageLimit } from "@/lib/ai-usage-limits";
import { getOpenAIChatConfig, isSupabaseConfigured } from "@/lib/env";
import { fetchUserIsPlusMember } from "@/lib/user-plus-membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const itemSchema = z.object({
  category: z.string().min(1).max(80),
  limit_base: z.coerce.number().finite().positive(),
  pct: z.coerce.number().finite().min(0).max(100).optional(),
  rationale: z.string().max(240).optional(),
});

const budgetSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency: z.string().min(3).max(8).optional(),
  note: z.string().max(600).optional(),
  items: z.array(itemSchema).min(1).max(20),
});

type BudgetOut = z.infer<typeof budgetSchema>;

function monthStartISO(raw?: string | null): string {
  const s = String(raw ?? "").trim();
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s.slice(0, 7)}-01`;
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function startDateDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - Math.max(1, Math.floor(days)));
  return d.toISOString().slice(0, 10);
}

type TxLite = { type: string | null; category: string | null; amount_base: number | null; occurred_on: string | null };

function summarizeTransactions(rows: TxLite[]) {
  const byCat: Record<string, number> = {};
  let income = 0;
  let expense = 0;

  for (const r of rows) {
    const amt = Number(r.amount_base ?? 0);
    if (!Number.isFinite(amt) || amt <= 0) continue;
    const t = String(r.type ?? "");
    if (t === "income") income += amt;
    else if (t === "expense") {
      expense += amt;
      const c = String(r.category ?? "").trim() || "uncategorized";
      byCat[c] = (byCat[c] ?? 0) + amt;
    }
  }

  const catPairs = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  return { income, expense, catPairs };
}

function buildBudgetSystemPrompt(locale: "zh" | "en"): string {
  if (locale === "zh") {
    return [
      "你是个人理财预算规划助手。",
      "根据输入的收入/支出概览，为用户生成一个“可执行的月度预算分配方案”。",
      "输出必须是 JSON，仅包含这些字段：",
      '{"month":"YYYY-MM-01","currency":"USD","note":"...","items":[{"category":"...","limit_base":123.45,"pct":12.3,"rationale":"..."}]}',
      "规则：",
      "- limit_base 是以 USD 本位币计的每月支出上限（正数）。",
      "- items 仅包含支出类别（不要包含 income）。",
      "- items 按重要性排序，至少 3 条、最多 12 条支出类别（勿只返回 1～2 条）。",
      "- pct 为可选，用于展示（0-100）。",
      "- 不要编造用户没有提供的具体账单；以“建议/假设”口吻。",
      "- note 简短说明假设与建议（<= 600 字）。",
    ].join("\n");
  }
  return [
    "You are a budgeting assistant for a personal finance app.",
    "Given income/spending summaries, generate an actionable monthly budget allocation plan.",
    "Output MUST be JSON only with these fields:",
    '{"month":"YYYY-MM-01","currency":"USD","note":"...","items":[{"category":"...","limit_base":123.45,"pct":12.3,"rationale":"..."}]}',
    "Rules:",
    "- limit_base is a monthly spending cap in USD base currency (positive).",
    "- items are expense categories only (do not include income).",
      "- At least 3 and at most 12 expense categories (never return only 1–2 items).",
    "- pct is optional (0-100) for display.",
    "- Do not invent specific unseen bills; phrase as suggestions/assumptions.",
    "- note should be concise (<= 600 chars).",
  ].join("\n");
}

function buildBudgetUserPrompt(params: {
  monthISO: string;
  locale: "zh" | "en";
  monthlyIncomeHint: number | null;
  income90: number;
  expense90: number;
  topCats: Array<{ category: string; spend: number }>;
}): string {
  const top = params.topCats.slice(0, 12);
  const lines = [
    `month=${params.monthISO}`,
    `income_90d_usd=${params.income90.toFixed(2)}`,
    `expense_90d_usd=${params.expense90.toFixed(2)}`,
    params.monthlyIncomeHint != null ? `profile_monthly_income_usd_hint=${params.monthlyIncomeHint.toFixed(2)}` : "",
    "top_expense_categories_90d_usd=",
    ...top.map((x) => `- ${x.category}: ${x.spend.toFixed(2)}`),
  ].filter(Boolean);
  return lines.join("\n");
}

function extractJsonText(raw: string): string {
  const t = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (fenced?.[1]) return fenced[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) return t.slice(start, end + 1);
  return t;
}

const BUDGET_ITEM_FALLBACKS: Array<{ category: string; limit_base: number }> = [
  { category: "food", limit_base: 200 },
  { category: "transportation", limit_base: 80 },
  { category: "entertainment", limit_base: 50 },
  { category: "other", limit_base: 30 },
];

function normalizeBudgetPayload(parsed: unknown, monthISO: string): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  const o = { ...(parsed as Record<string, unknown>) };
  const m = String(o.month ?? "").trim();
  if (/^\d{4}-\d{2}$/.test(m)) o.month = `${m}-01`;
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(m)) o.month = monthISO;
  const note = String(o.note ?? "").trim();
  if (note) o.note = note.slice(0, 600);
  const cur = String(o.currency ?? "USD").trim();
  o.currency = cur.length >= 3 ? cur.slice(0, 8) : "USD";

  let items: Array<Record<string, unknown>> = [];
  if (Array.isArray(o.items)) {
    items = o.items
      .filter((it) => it && typeof it === "object")
      .map((it) => {
        const row = { ...(it as Record<string, unknown>) };
        const rawCat = row.category ?? row.name ?? row.label;
        const cat = String(rawCat ?? "").trim().slice(0, 80) || "other";
        const lbRaw = row.limit_base ?? row.limit ?? row.amount;
        const lb = Number(lbRaw);
        row.category = cat;
        row.limit_base = Number.isFinite(lb) && lb > 0 ? lb : 1;
        const pct = Number(row.pct);
        if (Number.isFinite(pct)) row.pct = Math.min(100, Math.max(0, pct));
        else delete row.pct;
        const rat = String(row.rationale ?? "").trim();
        if (rat) row.rationale = rat.slice(0, 240);
        else delete row.rationale;
        return row;
      });
  }

  const seen = new Set(items.map((it) => String(it.category).toLowerCase()));
  for (const fb of BUDGET_ITEM_FALLBACKS) {
    if (items.length >= 3) break;
    const key = fb.category.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ category: fb.category, limit_base: fb.limit_base });
  }
  o.items = items;
  return o;
}

function coerceToBudget(parsed: unknown, monthISO: string): BudgetOut | null {
  const normalized = normalizeBudgetPayload(parsed, monthISO);
  const decoded = budgetSchema.safeParse(normalized);
  return decoded.success ? decoded.data : null;
}

function isJsonObjectModeUnsupported(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /response_format|json_object|unknown_parameter|unsupported/i.test(msg);
}

async function completeJson(params: {
  client: OpenAI;
  model: string;
  locale: "zh" | "en";
  userPrompt: string;
  monthISO: string;
}): Promise<BudgetOut> {
  const run = async (opts: { strict: boolean; useJsonObject: boolean }) => {
    const body = {
      model: params.model,
      messages: [
        { role: "system" as const, content: buildBudgetSystemPrompt(params.locale) },
        {
          role: "user" as const,
          content: opts.strict
            ? `${params.userPrompt}\n\nReturn one JSON object only. Top-level keys: month, currency, note, items. No markdown fences.`
            : params.userPrompt,
        },
      ],
      temperature: opts.strict ? 0.35 : 0.6,
      max_tokens: 1400,
      ...(opts.useJsonObject ? { response_format: { type: "json_object" as const } } : {}),
    };
    try {
      return await params.client.chat.completions.create(body);
    } catch (e) {
      if (opts.useJsonObject && isJsonObjectModeUnsupported(e)) {
        const { response_format: _rf, ...withoutJsonMode } = body;
        void _rf;
        return await params.client.chat.completions.create(withoutJsonMode);
      }
      throw e;
    }
  };

  const parse = (text: string) => {
    const jsonText = extractJsonText(text);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText) as unknown;
    } catch {
      throw new Error("invalid_json");
    }
    const coerced = coerceToBudget(parsed, params.monthISO);
    if (coerced) return coerced;
    console.warn("budget-generate schema_mismatch", {
      preview: jsonText.slice(0, 600),
    });
    throw new Error("schema_mismatch");
  };

  const attempts: Array<{ strict: boolean; useJsonObject: boolean }> = [
    { strict: false, useJsonObject: true },
    { strict: true, useJsonObject: true },
    { strict: true, useJsonObject: false },
  ];

  let lastErr: unknown;
  for (const opts of attempts) {
    try {
      const completion = await run(opts);
      const raw = completion.choices[0]?.message?.content?.trim();
      if (!raw) throw new Error("empty_completion");
      return parse(raw);
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : "";
      if (msg === "invalid_json" || msg === "schema_mismatch" || msg === "empty_completion") continue;
      throw e;
    }
  }
  console.error("budget-generate completeJson failed", lastErr);
  throw lastErr instanceof Error ? lastErr : new Error("openai_failed");
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

  const locale = String((body as { locale?: unknown }).locale ?? "en").toLowerCase().startsWith("zh") ? ("zh" as const) : ("en" as const);
  const monthISO = monthStartISO(typeof (body as { month?: unknown }).month === "string" ? String((body as { month: string }).month) : null);
  const usageDate = todayUTC();
  const isPlus = await fetchUserIsPlusMember(supabase, auth.user.id);
  /** 与 AI 助手共用 assistant_count / 每日 assistant 额度 */
  const assistantLimit = getAiUsageLimit(isPlus, "assistant");

  const { data: usageRow, error: usageErr } = await supabase
    .from("ai_usage")
    .select("id, assistant_count")
    .eq("user_id", auth.user.id)
    .eq("date", usageDate)
    .maybeSingle();
  if (usageErr) return NextResponse.json({ ok: false, error: "usage_query_failed" }, { status: 500 });

  const used = Number(usageRow?.assistant_count ?? 0);
  if (used >= assistantLimit) {
    return NextResponse.json({ ok: false, error: "rate_limit", limit: assistantLimit }, { status: 429 });
  }

  const since = startDateDaysAgo(90);
  const { data: tx } = await supabase
    .from("transactions")
    .select("type,category,amount_base,occurred_on")
    .eq("user_id", auth.user.id)
    .gte("occurred_on", since)
    .limit(5000);

  const { data: profile } = await supabase.from("profiles").select("monthly_income").eq("id", auth.user.id).maybeSingle();
  const monthlyIncomeHint = profile?.monthly_income != null ? Number(profile.monthly_income) : null;

  const { income, expense, catPairs } = summarizeTransactions((tx ?? []) as TxLite[]);
  const topCats = catPairs.slice(0, 12).map(([category, spend]) => ({ category, spend }));

  const client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL, timeout: 55_000 });
  let generated: BudgetOut;
  try {
    generated = await completeJson({
      client,
      model: cfg.model,
      locale,
      monthISO,
      userPrompt: buildBudgetUserPrompt({
        monthISO,
        locale,
        monthlyIncomeHint: monthlyIncomeHint != null && Number.isFinite(monthlyIncomeHint) ? monthlyIncomeHint : null,
        income90: income,
        expense90: expense,
        topCats,
      }),
    });
  } catch (e) {
    console.error("budget-generate", e);
    return NextResponse.json({ ok: false, error: "openai_failed" }, { status: 502 });
  }

  const derivedMetrics = computeMonthlyDerivedMetrics({
    income90: income,
    expense90: expense,
    monthlyIncomeHint:
      monthlyIncomeHint != null && Number.isFinite(monthlyIncomeHint) ? monthlyIncomeHint : null,
  });

  let resolvedItems = generated.items.map((it) => ({ ...it }));
  resolvedItems = applyDerivedSavingsEmergencyLimits(resolvedItems, derivedMetrics, locale);
  resolvedItems = recalculateBudgetItemPct(resolvedItems);

  const budgetMonth = monthStartISO(generated.month);
  const { data: budgetRow, error: upErr } = await supabase
    .from("budgets")
    .upsert(
      {
        user_id: auth.user.id,
        month: budgetMonth,
        currency: String(generated.currency ?? "USD").trim() || "USD",
        source: "ai",
        note: generated.note ?? null,
      },
      { onConflict: "user_id,month" },
    )
    .select("id,month,currency,note")
    .maybeSingle();

  if (upErr || !budgetRow?.id) {
    return NextResponse.json({ ok: false, error: "db_write_failed" }, { status: 500 });
  }

  const budgetId = String(budgetRow.id);
  await supabase.from("budget_items").delete().eq("budget_id", budgetId);
  const items = resolvedItems.map((it) => ({
    budget_id: budgetId,
    category: it.category.trim(),
    limit_base: it.limit_base,
    pct: typeof it.pct === "number" ? it.pct : null,
    rationale: it.rationale ?? null,
  }));
  const { error: insItemsErr } = await supabase.from("budget_items").insert(items);
  if (insItemsErr) {
    return NextResponse.json({ ok: false, error: "db_write_failed" }, { status: 500 });
  }

  const nextCount = used + 1;
  if (!usageRow?.id) {
    await supabase.from("ai_usage").insert({ user_id: auth.user.id, date: usageDate, assistant_count: nextCount });
  } else {
    await supabase.from("ai_usage").update({ assistant_count: nextCount }).eq("id", usageRow.id).eq("user_id", auth.user.id);
  }

  let spentByCategory: Record<string, number> = {};
  try {
    spentByCategory = await fetchExpenseTotalsByCategory(supabase, auth.user.id, budgetMonth);
  } catch (e) {
    console.error("budget spent snapshot", e);
  }

  return NextResponse.json({
    ok: true,
    budget: { id: budgetId, month: budgetMonth, currency: String(budgetRow.currency ?? "USD"), note: budgetRow.note ?? null, items },
    spentByCategory,
    remaining: Math.max(0, assistantLimit - nextCount),
    limit: assistantLimit,
  });
}

