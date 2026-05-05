import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  applyDerivedSavingsEmergencyLimits,
  computeMonthlyDerivedMetrics,
  recalculateBudgetItemPct,
} from "@/lib/budget-derived-limits";
import { fetchExpenseTotalsByCategory } from "@/lib/budget-progress";
import { assistantDailyLimit, getOpenAIChatConfig, isSupabaseConfigured } from "@/lib/env";
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
  items: z.array(itemSchema).min(3).max(20),
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
      "- items 按重要性排序，3-12 条为宜。",
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
    "- 3-12 items, sorted by importance.",
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

async function completeJson(params: {
  client: OpenAI;
  model: string;
  locale: "zh" | "en";
  userPrompt: string;
}): Promise<BudgetOut> {
  const run = async (strict: boolean) => {
    return await params.client.chat.completions.create({
      model: params.model,
      messages: [
        { role: "system", content: buildBudgetSystemPrompt(params.locale) },
        {
          role: "user",
          content: strict
            ? `${params.userPrompt}\n\nReturn JSON only. Do not include code fences.`
            : params.userPrompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: strict ? 0.4 : 0.65,
      max_tokens: 1200,
    });
  };

  const parse = (text: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      throw new Error("invalid_json");
    }
    const decoded = budgetSchema.safeParse(parsed);
    if (!decoded.success) throw new Error("schema_mismatch");
    return decoded.data;
  };

  try {
    const c1 = await run(false);
    const raw1 = c1.choices[0]?.message?.content?.trim();
    if (!raw1) throw new Error("empty_completion");
    return parse(raw1);
  } catch {
    const c2 = await run(true);
    const raw2 = c2.choices[0]?.message?.content?.trim();
    if (!raw2) throw new Error("empty_completion");
    return parse(raw2);
  }
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

  const { data: usageRow, error: usageErr } = await supabase
    .from("ai_usage")
    .select("id, assistant_count")
    .eq("user_id", auth.user.id)
    .eq("date", usageDate)
    .maybeSingle();
  if (usageErr) return NextResponse.json({ ok: false, error: "usage_query_failed" }, { status: 500 });

  const used = Number(usageRow?.assistant_count ?? 0);
  if (used >= assistantDailyLimit) {
    return NextResponse.json({ ok: false, error: "rate_limit", limit: assistantDailyLimit }, { status: 429 });
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
      userPrompt: buildBudgetUserPrompt({
        monthISO,
        locale,
        monthlyIncomeHint: monthlyIncomeHint != null && Number.isFinite(monthlyIncomeHint) ? monthlyIncomeHint : null,
        income90: income,
        expense90: expense,
        topCats,
      }),
    });
  } catch {
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
    remaining: Math.max(0, assistantDailyLimit - nextCount),
    limit: assistantDailyLimit,
  });
}

