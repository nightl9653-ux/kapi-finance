"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toCsvTable } from "@/lib/csv";
import { csvTableToObjects, parseCsv } from "@/lib/csv-parse";
import { BASE_CURRENCY, coerceCurrency } from "@/lib/fx";
import type { Locale } from "@/i18n/locales";

type BulkRow = {
  occurred_on: string;
  type: "expense" | "income";
  amount: string | number;
  currency?: string;
  fx_rate?: string | number;
  category: string;
  merchant?: string;
  note?: string;
};

const REQUIRED_HEADERS = ["occurred_on", "type", "amount", "category"] as const;
const OPTIONAL_HEADERS = ["merchant", "note", "currency", "fx_rate"] as const;

function normalizeType(v: string): "expense" | "income" | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "expense" || s === "支出") return "expense";
  if (s === "income" || s === "收入") return "income";
  if (s.includes("支出")) return "expense";
  if (s.includes("收入")) return "income";
  return null;
}

function asIsoDate(v: string): string | null {
  const s = String(v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // allow YYYY-MM-DD HH:mm:ss
  const m1 = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(:\d{2})?/.exec(s);
  if (m1) return m1[1];
  // allow YYYY/MM/DD
  const m = /^(\d{4})[\/.](\d{1,2})[\/.](\d{1,2})$/.exec(s);
  if (m) {
    const y = m[1];
    const mm = String(m[2]).padStart(2, "0");
    const dd = String(m[3]).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }
  return null;
}

type MappingKey = (typeof REQUIRED_HEADERS)[number] | (typeof OPTIONAL_HEADERS)[number];

function normalizeHeaderName(s: string) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()（）]/g, "");
}

const HEADER_SYNONYMS: Record<MappingKey, string[]> = {
  occurred_on: ["occurred_on", "date", "日期", "交易日期", "记账日期", "时间", "交易时间", "消费时间"],
  type: ["type", "收支", "收支类型", "类型", "交易类型", "支出/收入", "收入支出", "收/支"],
  amount: ["amount", "金额", "交易金额", "支出金额", "收入金额", "总金额", "实付", "付款金额", "入账金额"],
  category: ["category", "分类", "类目", "消费分类", "收支分类"],
  merchant: ["merchant", "商户", "商家", "对方", "交易对方", "收款方", "付款方", "对方户名", "商户名称", "店铺", "店铺名称"],
  note: ["note", "备注", "说明", "商品", "商品说明", "内容", "交易摘要", "摘要", "标题", "用途"],
  currency: ["currency", "币种", "货币"],
  fx_rate: ["fx_rate", "fxrate", "汇率", "兑换率"],
};

function guessMapping(headers: string[]) {
  const normToOriginal = new Map<string, string>();
  for (const h of headers) normToOriginal.set(normalizeHeaderName(h), h);

  const pick = (key: MappingKey) => {
    for (const cand of HEADER_SYNONYMS[key]) {
      const got = normToOriginal.get(normalizeHeaderName(cand));
      if (got) return got;
    }
    // fuzzy contains
    const norms = headers.map((h) => ({ h, n: normalizeHeaderName(h) }));
    for (const cand of HEADER_SYNONYMS[key]) {
      const c = normalizeHeaderName(cand);
      const hit = norms.find((x) => x.n.includes(c) || c.includes(x.n));
      if (hit) return hit.h;
    }
    return "";
  };

  const mapping: Record<MappingKey, string> = {
    occurred_on: pick("occurred_on"),
    type: pick("type"),
    amount: pick("amount"),
    category: pick("category"),
    merchant: pick("merchant"),
    note: pick("note"),
    currency: pick("currency"),
    fx_rate: pick("fx_rate"),
  };
  return mapping;
}

export function CsvImportClient({
  locale,
  action,
}: {
  locale: Locale;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [rawText, setRawText] = useState<string>("");
  const [bulkJson, setBulkJson] = useState<string>("[]");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [autoFx, setAutoFx] = useState(true);
  const [mapping, setMapping] = useState<Record<MappingKey, string>>({
    occurred_on: "occurred_on",
    type: "type",
    amount: "amount",
    category: "category",
    merchant: "merchant",
    note: "note",
    currency: "currency",
    fx_rate: "fx_rate",
  });

  const template = useMemo(() => {
    const rows: (string | number | boolean)[][] = [
      [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS],
      ["2026-01-15", "expense", 18.8, "food", "便利店", "午餐", "CNY", ""],
      ["2026-01-20", "income", 5200, "salary", "公司", "工资", "CNY", ""],
    ];
    return toCsvTable(rows);
  }, []);

  const table = useMemo(() => {
    if (!rawText.trim()) return { headers: [] as string[], objects: [] as Record<string, string>[] };
    try {
      const t = parseCsv(rawText);
      const headers = t[0]?.map((h) => String(h ?? "").trim()) ?? [];
      const objects = csvTableToObjects(t);
      return { headers, objects };
    } catch {
      return { headers: [] as string[], objects: [] as Record<string, string>[] };
    }
  }, [rawText]);

  useEffect(() => {
    if (!table.headers.length) return;
    setMapping((prev) => {
      const guessed = guessMapping(table.headers);
      // only fill empty / default values to avoid fighting user changes
      const next = { ...prev };
      (Object.keys(guessed) as MappingKey[]).forEach((k) => {
        if (!next[k] || next[k] === k) next[k] = guessed[k] || next[k];
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.headers.join("\n")]);

  const parsed = useMemo(() => {
    setError(null);
    if (!rawText.trim()) {
      setBulkJson("[]");
      return { headers: [] as string[], rows: [] as BulkRow[] };
    }

    try {
      if (!table.headers.length) throw new Error("无法识别表头，请确认 CSV 内容是否正确。");
      const get = (o: Record<string, string>, key: MappingKey) => {
        const col = mapping[key];
        if (!col) return "";
        return String(o[col] ?? "").trim();
      };

      for (const k of REQUIRED_HEADERS) {
        if (!mapping[k]) throw new Error(`请为必填字段选择列：${k}`);
      }

      const rows: BulkRow[] = table.objects.map((o) => {
        const occurredRaw = get(o, "occurred_on");
        const occurred = asIsoDate(occurredRaw);
        const typeRaw = get(o, "type");
        const type = normalizeType(typeRaw);
        const amountRaw = get(o, "amount");
        const amount = Number(String(amountRaw ?? "").replace(/[, ]/g, ""));
        const category = get(o, "category");
        const merchant = get(o, "merchant");
        const note = get(o, "note");
        const currency = get(o, "currency");
        const fx_rate = get(o, "fx_rate");

        return {
          occurred_on: occurred ?? occurredRaw,
          type: (type ?? "expense") as "expense" | "income",
          amount,
          currency: currency || undefined,
          fx_rate: fx_rate || undefined,
          category,
          merchant: merchant || undefined,
          note: note || undefined,
        };
      });

      if (!rows.length) throw new Error("未解析到任何数据行。");
      setBulkJson(JSON.stringify(rows));
      return { headers: table.headers, rows };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "解析失败";
      setError(msg);
      setBulkJson("[]");
      return { headers: [] as string[], rows: [] as BulkRow[] };
    }
  }, [rawText, table.headers, table.objects, mapping]);

  const canSubmit = !error && parsed.rows.length > 0 && parsed.rows.length <= 200;

  const onDownloadTemplate = () => {
    const blob = new Blob([template], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kapi-transactions-template.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const onLoadFile: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setRawText(text);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">通用 CSV 导入</div>
            <div className="text-xs text-muted-foreground">
              可导入任意 CSV：上传后为必填字段选择列映射。
            </div>
          </div>
          <Button type="button" variant="outline" onClick={onDownloadTemplate}>
            下载模板
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="csvFile">选择 CSV 文件</Label>
            <Input id="csvFile" type="file" accept=".csv,text/csv" onChange={onLoadFile} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="csvText">或直接粘贴 CSV 内容</Label>
            <textarea
              id="csvText"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="h-28 w-full resize-y rounded-md border bg-background px-3 py-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder={template.split("\n").slice(0, 3).join("\n")}
            />
          </div>
        </div>

        {error ? <div className="mt-3 text-sm text-destructive">{error}</div> : null}
        {parsed.rows.length > 200 ? (
          <div className="mt-3 text-sm text-destructive">最多一次导入 200 行，请拆分文件后再导入。</div>
        ) : null}

        {table.headers.length ? (
          <div className="mt-4 rounded-lg border bg-muted/20 p-3">
            <div className="text-sm font-medium">列映射</div>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  { key: "occurred_on" as const, label: "日期 occurred_on（必填）" },
                  { key: "type" as const, label: "收支 type（必填）" },
                  { key: "amount" as const, label: "金额 amount（必填）" },
                  { key: "category" as const, label: "分类 category（必填）" },
                  { key: "merchant" as const, label: "商户 merchant（可选）" },
                  { key: "note" as const, label: "备注 note（可选）" },
                  { key: "currency" as const, label: "币种 currency（可选）" },
                  { key: "fx_rate" as const, label: "汇率 fx_rate（可选）" },
                ] as const
              ).map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <div className="text-xs text-muted-foreground">{f.label}</div>
                  <select
                    value={mapping[f.key] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">
                      {f.key === "merchant" || f.key === "note" || f.key === "currency" || f.key === "fx_rate"
                        ? "不导入"
                        : "请选择…"}
                    </option>
                    {table.headers.map((h) => (
                      <option key={`${f.key}:${h}`} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              提示：日期支持 <span className="font-mono">YYYY-MM-DD</span>、<span className="font-mono">YYYY/MM/DD</span>、以及带时间的{" "}
              <span className="font-mono">YYYY-MM-DD HH:mm:ss</span>（会自动取日期）。
            </div>

            <label className="mt-3 flex select-none items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={autoFx}
                onChange={(e) => setAutoFx(e.target.checked)}
                className="h-4 w-4 accent-foreground"
              />
              缺少汇率时，按 occurred_on 自动拉取当日汇率（换算到 {BASE_CURRENCY}）
            </label>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium">预览</div>
          <div className="text-xs text-muted-foreground">共 {parsed.rows.length} 行</div>
        </div>
        {parsed.rows.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[560px] text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 pr-3 text-left font-medium">occurred_on</th>
                  <th className="py-2 pr-3 text-left font-medium">type</th>
                  <th className="py-2 pr-3 text-left font-medium">amount</th>
                  <th className="py-2 pr-3 text-left font-medium">category</th>
                  <th className="py-2 pr-3 text-left font-medium">merchant</th>
                  <th className="py-2 pr-3 text-left font-medium">note</th>
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 10).map((r, idx) => (
                  <tr key={idx} className="border-b last:border-b-0">
                    <td className="py-2 pr-3 tabular-nums">{r.occurred_on}</td>
                    <td className="py-2 pr-3">{r.type}</td>
                    <td className="py-2 pr-3 tabular-nums">{String(r.amount)}</td>
                    <td className="py-2 pr-3">{r.category}</td>
                    <td className="py-2 pr-3">{r.merchant ?? ""}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsed.rows.length > 10 ? (
              <div className="mt-2 text-xs text-muted-foreground">仅预览前 10 行</div>
            ) : null}
          </div>
        ) : (
          <div className="mt-3 text-sm text-muted-foreground">导入后会在这里显示预览。</div>
        )}
      </div>

      <form
        action={(fd) => {
          startTransition(async () => {
            setError(null);
            try {
              let rows = parsed.rows;
              if (autoFx) {
                const cache = new Map<string, number>(); // key: CUR@DATE
                const need = rows.filter((r) => {
                  const cur = coerceCurrency(r.currency);
                  const fx = Number(r.fx_rate);
                  return cur !== BASE_CURRENCY && !(Number.isFinite(fx) && fx > 0);
                });

                if (need.length) {
                  const next = [...rows];
                  for (let i = 0; i < next.length; i++) {
                    const r = next[i]!;
                    const cur = coerceCurrency(r.currency);
                    if (cur === BASE_CURRENCY) {
                      r.fx_rate = "1";
                      r.currency = BASE_CURRENCY;
                      continue;
                    }
                    const fx = Number(r.fx_rate);
                    if (Number.isFinite(fx) && fx > 0) continue;
                    const date = asIsoDate(r.occurred_on) ?? r.occurred_on;
                    const k = `${cur}@${date}`;
                    const hit = cache.get(k);
                    if (hit) {
                      r.fx_rate = String(hit);
                      continue;
                    }
                    const res = await fetch(
                      `/api/fx?from=${encodeURIComponent(cur)}&to=${encodeURIComponent(BASE_CURRENCY)}&date=${encodeURIComponent(date)}`,
                    );
                    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; rate?: number };
                    const rate = Number(data.rate);
                    if (!res.ok || !data.ok || !Number.isFinite(rate) || rate <= 0) {
                      throw new Error(`无法获取汇率：${cur} -> ${BASE_CURRENCY}（${date}）`);
                    }
                    cache.set(k, rate);
                    r.fx_rate = String(rate);
                  }
                  rows = next;
                }
              }

              fd.set("locale", locale);
              fd.set("bulk", JSON.stringify(rows));
              fd.set("return_to", "transactions");
              await action(fd);
            } catch (e) {
              const msg = e instanceof Error ? e.message : "导入失败";
              setError(msg);
            }
          });
        }}
      >
        <Button type="submit" disabled={!canSubmit || isPending}>
          导入到「交易」
        </Button>
      </form>
    </div>
  );
}

