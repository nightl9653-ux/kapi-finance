import OpenAI from "openai";
import { z } from "zod";

import { EXPENSE_CATEGORY_KEYS, INCOME_CATEGORY_KEYS, parseCategoryUiState } from "@/lib/transaction-categories";

const extractedSchema = z.object({
  transactions: z
    .array(
      z.object({
        amount: z.coerce.number().positive(),
        type: z.enum(["expense", "income"]).optional(),
        occurred_on: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        merchant: z.string().optional(),
        note: z.string().optional(),
        category_key: z.string().optional(),
      }),
    )
    .min(0)
    .max(50),
});

type Extracted = z.infer<typeof extractedSchema>;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function normalizeType(raw: unknown): "expense" | "income" | undefined {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (v === "expense" || v === "income") return v;
  // 常见中文/缩写
  if (v.includes("收入") || v.includes("进账") || v.includes("入") || v.includes("refund") || v.includes("cashback")) return "income";
  if (v.includes("支出") || v.includes("消费") || v.includes("花费") || v.includes("出") || v.includes("paid")) return "expense";
  return undefined;
}

function normalizeDate(raw: unknown): string | undefined {
  const v = String(raw ?? "").trim();
  if (!v) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // 兼容 YYYY/MM/DD 或 YYYY.MM.DD
  const m = v.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
  if (!m) return undefined;
  const y = m[1]!;
  const mm = String(m[2]!).padStart(2, "0");
  const dd = String(m[3]!).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function normalizeAmount(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  const s = String(raw ?? "").trim();
  if (!s) return null;
  // 抓取第一个正数（允许逗号分隔）
  const cleaned = s.replace(/[,，]/g, "");
  const m = cleaned.match(/(\d+(?:\.\d{1,2})?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function coerceToExtracted(parsed: unknown): Extracted | null {
  // 常见变体：{ transactions: [...] } / { rows: [...] } / { items: [...] }
  const root = asRecord(parsed);
  if (!root) return null;

  const candidates =
    (Array.isArray(root.transactions) && root.transactions) ||
    (Array.isArray(root.rows) && root.rows) ||
    (Array.isArray(root.items) && root.items) ||
    (Array.isArray(root.data) && root.data) ||
    null;

  if (!candidates) return null;

  const tx = candidates
    .map((x) => {
      const r = asRecord(x);
      if (!r) return null;
      const amount = normalizeAmount(r.amount ?? r.total ?? r.price ?? r.money);
      if (!amount) return null;
      const type = normalizeType(r.type ?? r.kind ?? r.direction);
      const occurred_on = normalizeDate(r.occurred_on ?? r.date ?? r.occurredOn);
      const merchant = typeof r.merchant === "string" ? r.merchant : typeof r.shop === "string" ? r.shop : undefined;
      const note = typeof r.note === "string" ? r.note : typeof r.memo === "string" ? r.memo : undefined;
      const category_key =
        typeof r.category_key === "string"
          ? r.category_key
          : typeof r.category === "string"
            ? r.category
            : undefined;
      return { amount, type, occurred_on, merchant, note, category_key };
    })
    .filter(Boolean);

  if (!tx.length) return null;

  const maybe = extractedSchema.safeParse({ transactions: tx });
  return maybe.success ? maybe.data : null;
}

export type ScanReceiptBulkRow = {
  occurred_on: string;
  type: "expense" | "income";
  amount: string;
  categoryPreset: string;
  categoryCustom: string;
  note: string;
};

const EXPENSE_KEYS_TEXT = EXPENSE_CATEGORY_KEYS.join(", ");
const INCOME_KEYS_TEXT = INCOME_CATEGORY_KEYS.join(", ");

function normalizeCategoryKey(raw: string | undefined, type: "expense" | "income"): string {
  const k = String(raw ?? "")
    .trim()
    .toLowerCase();
  const allowed = type === "income" ? INCOME_CATEGORY_KEYS : EXPENSE_CATEGORY_KEYS;
  if ((allowed as readonly string[]).includes(k)) return k;
  return "other";
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildSystemPrompt(): string {
  return [
    "You extract structured transaction data from receipt or payment screenshots.",
    "Respond with JSON only, no markdown.",
    `Schema: {"transactions":[{"amount":number (positive, major currency units),"type":"expense"|"income","occurred_on":"YYYY-MM-DD" (transaction date on the receipt; guess if unclear),"category_key":"...","merchant":"string optional","note":"string optional"}]}`,
    "Amounts MUST be in major currency units (e.g., dollars, euros, yuan, yen) — never cents/fen.",
    'If a currency symbol/code is present (¥/$/€/£/USD/EUR/CNY/JPY/GBP/HKD/AUD/CAD), use it to infer currency and put the chosen currency code into note like "Currency: XXX".',
    'If currency is not clearly indicated, DO NOT guess the currency — extract the numeric amount only and omit currency (do not invent one).',
    `For expense rows, category_key MUST be one of: ${EXPENSE_KEYS_TEXT}.`,
    `For income rows, category_key MUST be one of: ${INCOME_KEYS_TEXT}.`,
    'Type rules (important): if the content indicates refund/cashback/reimbursement/salary/received/income, set type="income". If it indicates payment/charged/debit/expense/paid/purchase, set type="expense". If still unclear, default to expense.',
    'If the content indicates transfer/top-up/withdrawal/credit-card payment/repayment, keep type by semantics (if unclear, expense) and add a note like "Transfer/Top-up/Withdrawal/Credit card payment" to help users review.',
    'Date rules: if an explicit date is present, use it. If no date is present, use today. For voice text, resolve relative dates like "today/yesterday/last Friday" into a concrete YYYY-MM-DD when possible; otherwise use today.',
    'Voice often contains multiple transactions in one sentence (e.g., "breakfast 20, metro 3, coffee 18") — split into multiple objects in "transactions".',
    "If the receipt shows multiple line items or multiple payments, return multiple objects.",
    "If you cannot find a numeric total but see line items, sum the relevant items for amount.",
    "Default type to expense when unclear.",
    'If you cannot confidently extract ANY transaction amount from the image, output exactly: {"transactions":[]}.',
  ].join("\n");
}

function buildUserTextPrompt(locale: string, text: string): string {
  const zh = locale.toLowerCase().startsWith("zh");
  return [
    zh
      ? [
          "从下面的语音转写/口述记账文本中，提取结构化交易数据。",
          "仅返回 JSON，不要 markdown，不要额外解释。",
          "",
          "关键规则：",
          '- 一句话里可能有多笔（例如“早餐20，地铁3，咖啡18”）——必须拆成多条 transactions。',
          "- 每条交易都要有 amount；type/occurred_on/category_key/merchant/note 尽量补全，不确定可省略，但不要编造。",
          "- 只有相对日期（今天/昨天/上周五）时，尽量换算为具体 YYYY-MM-DD；无法确定就不写日期（系统会按今天处理）。",
          "",
          "示例（仅示意输出结构，不要输出示例文字）：",
          "输入：早餐20，地铁3，下午咖啡18",
          '输出：{"transactions":[{"amount":20,"type":"expense"},{"amount":3,"type":"expense"},{"amount":18,"type":"expense"}]}',
        ].join("\n")
      : [
          "Extract structured transaction data from the voice transcript below.",
          "Return JSON only. No markdown. No extra explanation.",
          "",
          "Key rules:",
          '- One sentence may contain multiple transactions (e.g., "breakfast 20, metro 3, coffee 18") — split into multiple objects in `transactions`.',
          "- Each transaction must have `amount`. Fill `type/occurred_on/category_key/merchant/note` when confident; if uncertain, omit rather than invent.",
          '- Resolve relative dates like "today/yesterday/last Friday" into a concrete YYYY-MM-DD when possible; otherwise omit the date (system will default to today).',
          "",
          "Example (structure only, do not output this example text):",
          'Input: "breakfast 20, metro 3, coffee 18"',
          'Output: {"transactions":[{"amount":20,"type":"expense"},{"amount":3,"type":"expense"},{"amount":18,"type":"expense"}]}',
        ].join("\n"),
    "",
    text.trim(),
  ]
    .filter(Boolean)
    .join("\n");
}

export async function extractTransactionsFromImage(params: {
  apiKey: string;
  model: string;
  baseURL?: string;
  base64: string;
  mimeType: string;
  /** 用于备注里「商户」前缀文案 */
  locale: string;
}): Promise<{ rows: ScanReceiptBulkRow[] }> {
  // 默认超时在部分网络/大图场景下偏紧；这里放宽并允许一次重试
  const client = new OpenAI({ apiKey: params.apiKey, baseURL: params.baseURL, timeout: 90_000 });
  const dataUrl = `data:${params.mimeType};base64,${params.base64}`;

  const run = async (opts?: { maxTokens?: number; forceStrictSchema?: boolean }) => {
    const strictHint = opts?.forceStrictSchema
      ? [
          "Return EXACTLY one JSON object with a single top-level key: transactions.",
          'Do NOT wrap it in any other keys like data/items/rows/result. No extra keys.',
          'Valid examples: {"transactions":[{...}]} or {"transactions":[]}.',
        ].join("\n")
      : "";
    return await client.chat.completions.create({
      model: params.model,
      messages: [
        { role: "system", content: [buildSystemPrompt(), strictHint].filter(Boolean).join("\n") },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract transactions from this image. JSON only." },
            { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: opts?.maxTokens ?? 900,
    });
  };

  const parseCompletion = (rawText: string): { decoded: Extracted; source: "strict" | "coerced" } => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText) as unknown;
    } catch {
      throw new Error("invalid_json");
    }

    const decoded = extractedSchema.safeParse(parsed);
    if (decoded.success) return { decoded: decoded.data, source: "strict" };

    const coerced = coerceToExtracted(parsed);
    if (coerced) return { decoded: coerced, source: "coerced" };

    const root = asRecord(parsed);
    const keys = root ? Object.keys(root).slice(0, 30) : [];
    console.warn("scan-receipt-ai schema_mismatch", {
      topKeys: keys,
      contentPreview: rawText.slice(0, 800),
    });
    throw new Error("schema_mismatch");
  };

  const runAndParse = async (opts?: { maxTokens?: number; forceStrictSchema?: boolean }) => {
    const completion = await run(opts);
    const rawText = completion.choices[0]?.message?.content?.trim();
    if (!rawText) throw new Error("empty_completion");
    return parseCompletion(rawText);
  };

  let decoded: Extracted;
  try {
    // 首次：常规参数
    ({ decoded } = await runAndParse({ maxTokens: 900 }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    const isTimeout = /timed out/i.test(msg);
    const isFormat = msg === "invalid_json" || msg === "schema_mismatch";
    if (!isTimeout && !isFormat) throw e;

    // 一次重试：更严格 schema 提示 + 缩短输出，降低“跑偏/超时”概率
    ({ decoded } = await runAndParse({ maxTokens: isTimeout ? 650 : 750, forceStrictSchema: true }));
  }

  if (!decoded.transactions.length) throw new Error("no_transactions");

  const rows: ScanReceiptBulkRow[] = decoded.transactions.map((t) => {
    const type: "expense" | "income" = t.type === "income" ? "income" : "expense";
    const catKey = normalizeCategoryKey(t.category_key, type);
    const { preset, custom } = parseCategoryUiState(catKey, type);
    const merchant = String(t.merchant ?? "").trim();
    const noteRaw = String(t.note ?? "").trim();
    const zh = params.locale.toLowerCase().startsWith("zh");
    const merchantPart = merchant ? (zh ? `商户：${merchant}` : `Merchant: ${merchant}`) : "";
    const noteMerged = [merchantPart, noteRaw].filter(Boolean).join(zh ? " · " : " · ");

    return {
      occurred_on: t.occurred_on ?? todayISO(),
      type,
      amount: String(t.amount),
      categoryPreset: preset,
      categoryCustom: custom,
      note: noteMerged,
    };
  });

  return { rows };
}

export async function extractTransactionsFromText(params: {
  apiKey: string;
  model: string;
  baseURL?: string;
  text: string;
  locale: string;
}): Promise<{ rows: ScanReceiptBulkRow[] }> {
  const client = new OpenAI({ apiKey: params.apiKey, baseURL: params.baseURL, timeout: 90_000 });

  const completion = await client.chat.completions.create({
    model: params.model,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserTextPrompt(params.locale, params.text) },
    ],
    response_format: { type: "json_object" },
    max_tokens: 900,
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("empty_completion");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("invalid_json");
  }

  const decoded = extractedSchema.safeParse(parsed);
  if (!decoded.success) throw new Error("schema_mismatch");
  if (!decoded.data.transactions.length) throw new Error("no_transactions");

  const rows: ScanReceiptBulkRow[] = decoded.data.transactions.map((t) => {
    const type: "expense" | "income" = t.type === "income" ? "income" : "expense";
    const catKey = normalizeCategoryKey(t.category_key, type);
    const { preset, custom } = parseCategoryUiState(catKey, type);
    const merchant = String(t.merchant ?? "").trim();
    const noteRaw = String(t.note ?? "").trim();
    const zh = params.locale.toLowerCase().startsWith("zh");
    const merchantPart = merchant ? (zh ? `商户：${merchant}` : `Merchant: ${merchant}`) : "";
    const noteMerged = [merchantPart, noteRaw].filter(Boolean).join(zh ? " · " : " · ");

    return {
      occurred_on: t.occurred_on ?? todayISO(),
      type,
      amount: String(t.amount),
      categoryPreset: preset,
      categoryCustom: custom,
      note: noteMerged,
    };
  });

  return { rows };
}
