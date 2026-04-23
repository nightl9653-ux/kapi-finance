"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ScanReceiptBulkRow } from "@/lib/scan-receipt-ai";
import {
  CATEGORY_CUSTOM,
  coerceTransactionCategory,
  defaultPresetForType,
  EXPENSE_CATEGORY_KEYS,
  formatCategoryLabel,
  INCOME_CATEGORY_KEYS,
} from "@/lib/transaction-categories";
import { coerceCurrency } from "@/lib/fx";

type BulkRow = {
  occurred_on: string;
  type: "expense" | "income";
  amount: string;
  currency: string;
  fx_mode: "auto" | "manual";
  fx_rate: string;
  categoryPreset: string;
  categoryCustom: string;
  note: string;
};

type RowFieldErrors = Partial<Record<"occurred_on" | "amount" | "category", string>>;
type FxApiResponse = { rate?: unknown };
type DedupReason = "exact" | "similar";

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function newRow(date?: string): BulkRow {
  return {
    occurred_on: date ?? todayISO(),
    type: "expense",
    amount: "",
    currency: "USD",
    fx_mode: "auto",
    fx_rate: "",
    categoryPreset: defaultPresetForType("expense"),
    categoryCustom: "",
    note: "",
  };
}

export function BulkTransactionsForm({
  locale,
  action,
  prefillDate,
  initialRows,
  returnTo = "transactions",
  embedded = false,
}: {
  locale: string;
  action: (formData: FormData) => void;
  prefillDate?: string;
  /** 扫单预填；与 `key` 联用以便重新挂载后生效 */
  initialRows?: ScanReceiptBulkRow[];
  /** 批量保存后的服务端跳转：`quick` 用于 AI 快捷记账页 */
  returnTo?: "transactions" | "quick";
  /** 嵌入底部半屏时使用更紧凑的布局 */
  embedded?: boolean;
}) {
  const t = useTranslations("transactions");
  const common = useTranslations("common");
  const isZh = locale.toLowerCase().startsWith("zh");
  const [rows, setRows] = useState<BulkRow[]>(() =>
    initialRows?.length
      ? initialRows.map((r) => ({ ...r, currency: "USD", fx_mode: "auto", fx_rate: "" } as BulkRow))
      : [newRow(prefillDate)],
  );
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<RowFieldErrors[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [fxMode, setFxMode] = useState<"auto" | "manual">("auto");
  const [displayRate, setDisplayRate] = useState<string>("1"); // 1 USD = ? displayCurrency
  const [dupOpen, setDupOpen] = useState<Set<number>>(() => new Set());
  const rowRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [flashRow, setFlashRow] = useState<number | null>(null);

  const normalizeForDedup = (s: string): string => {
    return String(s ?? "")
      .trim()
      .toLowerCase()
      .replace(/\b(merchant|currency)\s*:\s*/g, "")
      .replace(/(商户|币种)\s*[:：]\s*/g, "")
      .replace(/[\s，,。．·•\-—_()（）[\]【】{}<>《》'"“”‘’]+/g, " ")
      .trim();
  };

  const dedup = useMemo(() => {
    const dupIdx = new Set<number>();
    const dupReasonByIdx = new Map<number, DedupReason>();
    const dupOfByIdx = new Map<number, number>();
    const keyOfExact = (r: BulkRow) => {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(r.occurred_on) ? r.occurred_on : "";
      const amt = Number(r.amount);
      const amountKey = Number.isFinite(amt) && amt > 0 ? amt.toFixed(2) : "";
      const noteKey = normalizeForDedup(r.note);
      return [date, amountKey, noteKey].join("|");
    };

    const tokenize = (s: string): string[] => {
      const norm = normalizeForDedup(s);
      if (!norm) return [];
      return norm
        .split(" ")
        .map((x) => x.trim())
        .filter((x) => x.length >= 2);
    };
    const jaccard = (a: string[], b: string[]): number => {
      if (!a.length || !b.length) return 0;
      const A = new Set(a);
      const B = new Set(b);
      let inter = 0;
      for (const x of A) if (B.has(x)) inter++;
      const uni = A.size + B.size - inter;
      return uni ? inter / uni : 0;
    };
    const extractMerchantHint = (note: string): string => {
      const raw = String(note ?? "");
      const m1 = raw.match(/(?:商户|Merchant)\s*[:：]\s*([^·•\-—_()（）[\]【】{}<>《》\n\r]+)/i);
      return normalizeForDedup(m1?.[1] ?? "");
    };

    // 1) 完全重复：date+amount+noteKey 完全一致
    const firstByExact = new Map<string, number>();
    for (let i = 0; i < rows.length; i++) {
      const k = keyOfExact(rows[i]!);
      if (!k || k === "||") continue;
      if (firstByExact.has(k)) {
        const first = firstByExact.get(k)!;
        dupIdx.add(i);
        dupReasonByIdx.set(i, "exact");
        dupOfByIdx.set(i, first);
      } else {
        firstByExact.set(k, i);
      }
    }

    // 2) 相似重复：date+amount 一样，且 note/merchant 高相似
    const groups = new Map<string, number[]>();
    for (let i = 0; i < rows.length; i++) {
      if (dupIdx.has(i)) continue; // 已经是完全重复，就不再计算相似
      const r = rows[i]!;
      const date = /^\d{4}-\d{2}-\d{2}$/.test(r.occurred_on) ? r.occurred_on : "";
      const amt = Number(r.amount);
      const amountKey = Number.isFinite(amt) && amt > 0 ? amt.toFixed(2) : "";
      if (!date || !amountKey) continue;
      const gk = `${date}|${amountKey}`;
      const arr = groups.get(gk) ?? [];
      arr.push(i);
      groups.set(gk, arr);
    }

    for (const idxs of groups.values()) {
      if (idxs.length <= 1) continue;
      const seen: { idx: number; tokens: string[]; merchant: string; noteNorm: string }[] = [];
      for (const idx of idxs) {
        const r = rows[idx]!;
        const noteNorm = normalizeForDedup(r.note);
        const merchant = extractMerchantHint(r.note);
        const tokens = tokenize(r.note);

        // 缺少备注时不做“相似”去重（避免误报）
        if (!noteNorm && !merchant && !tokens.length) {
          seen.push({ idx, tokens, merchant, noteNorm });
          continue;
        }

        let isDup = false;
        let dupOf = -1;
        for (const s of seen) {
          const merchantOk = merchant && s.merchant && merchant === s.merchant;
          const notePrefixOk =
            noteNorm &&
            s.noteNorm &&
            (noteNorm.startsWith(s.noteNorm) || s.noteNorm.startsWith(noteNorm)) &&
            Math.min(noteNorm.length, s.noteNorm.length) >= 6;
          const sim = jaccard(tokens, s.tokens);
          const similarOk = sim >= 0.85 && (tokens.length >= 3 || s.tokens.length >= 3);

          if (merchantOk || notePrefixOk || similarOk) {
            isDup = true;
            dupOf = s.idx;
            break;
          }
        }

        if (isDup) {
          dupIdx.add(idx);
          dupReasonByIdx.set(idx, "similar");
          if (dupOf >= 0) dupOfByIdx.set(idx, dupOf);
        } else {
          seen.push({ idx, tokens, merchant, noteNorm });
        }
      }
    }
    return { dupIdx, dupReasonByIdx, dupOfByIdx, dupCount: dupIdx.size };
  }, [rows]);

  useEffect(() => {
    if (flashRow == null) return;
    const t = window.setTimeout(() => setFlashRow(null), 900);
    return () => window.clearTimeout(t);
  }, [flashRow]);

  const scrollToRow = (idx: number) => {
    const el = rowRefs.current[idx];
    if (!el) return;
    try {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {
      el.scrollIntoView();
    }
    setFlashRow(idx);
  };

  const fxCurrenciesKey = useMemo(
    () => rows.map((r) => coerceCurrency(r.currency)).join("|"),
    [rows],
  );

  const validateRow = (r: BulkRow): RowFieldErrors => {
    const e: RowFieldErrors = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.occurred_on)) e.occurred_on = t("bulkClientFieldDate");
    const amt = Number(r.amount);
    if (!Number.isFinite(amt) || amt <= 0) e.amount = t("bulkClientFieldAmount");
    const cat = coerceTransactionCategory(r.type, r.categoryPreset, r.categoryCustom);
    if (!cat) e.category = t("bulkClientFieldCategory");
    return e;
  };

  useEffect(() => {
    // 行级校验状态随行数变化对齐（不强制实时校验，避免打字时频繁闪烁）
    setRowErrors((prev) => {
      if (prev.length === rows.length) return prev;
      const next = prev.slice(0, rows.length);
      while (next.length < rows.length) next.push({});
      return next;
    });
  }, [rows.length]);

  useEffect(() => {
    if (displayCurrency === "USD") {
      setDisplayRate("1");
      return;
    }
    if (fxMode !== "auto") return;
    let cancelled = false;
    fetch(`/api/fx?from=USD&to=${encodeURIComponent(displayCurrency)}`)
      .then((r) => r.json().catch(() => ({})))
      .then((d: unknown) => {
        if (cancelled) return;
        const rate = Number((d as FxApiResponse | null | undefined)?.rate);
        setDisplayRate(Number.isFinite(rate) && rate > 0 ? String(rate) : "");
      })
      .catch(() => {
        if (!cancelled) setDisplayRate("");
      });
    return () => {
      cancelled = true;
    };
  }, [displayCurrency, fxMode]);

  const usdToDisplay = useMemo(() => {
    const n = Number(displayRate);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [displayRate]);

  useEffect(() => {
    if (fxMode !== "auto") return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < rows.length; i++) {
        const cur = coerceCurrency(rows[i]?.currency);
        if (cur === "USD") continue;
        try {
          const r = await fetch(`/api/fx?from=${encodeURIComponent(cur)}&to=USD`).then((x) => x.json().catch(() => ({})));
          if (cancelled) return;
          const rate = Number((r as FxApiResponse | null | undefined)?.rate);
          if (!Number.isFinite(rate) || rate <= 0) continue;
          setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, fx_rate: String(rate) } : row)));
        } catch {
          // ignore
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fxMode, fxCurrenciesKey, rows]);

  const payload = useMemo(
    () =>
      JSON.stringify(
        rows.map((r) => ({
          occurred_on: r.occurred_on,
          type: r.type,
          amount: r.amount,
          currency: r.currency,
          fx_rate: r.fx_rate,
          category: coerceTransactionCategory(r.type, r.categoryPreset, r.categoryCustom) ?? "",
          note: r.note,
        })),
      ),
    [rows],
  );

  return (
    <div className={embedded ? "space-y-3" : "rounded-2xl border bg-white/70 p-6"}>
      {embedded ? null : (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-yellow-700">{t("bulkTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("bulkSubtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="rounded-full"
              onClick={() => setRows((prev) => [...prev, newRow(prefillDate)])}
            >
              {t("bulkAddRow")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="rounded-full"
              onClick={() => {
                setRows((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
              }}
              disabled={rows.length <= 1}
            >
              {t("bulkRemoveRow")}
            </Button>
          </div>
        </div>
      )}

      {error ? (
        <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {dedup.dupCount ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {isZh
                ? `检测到 ${dedup.dupCount} 行可能重复（同日期/金额/备注或商户）。`
                : `Detected ${dedup.dupCount} potentially duplicate row(s) (same date/amount/note or merchant).`}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                className="rounded-full"
                onClick={() => {
                  setRows((prev) => prev.filter((_, i) => !dedup.dupIdx.has(i)));
                  setRowErrors((prev) => prev.filter((_, i) => !dedup.dupIdx.has(i)));
                  setDupOpen(new Set());
                }}
              >
                {isZh ? "移除全部重复" : "Remove all duplicates"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="rounded-full"
                onClick={() => {
                  setRows((prev) => prev.filter((_, i) => dedup.dupReasonByIdx.get(i) !== "exact"));
                  setRowErrors((prev) => prev.filter((_, i) => dedup.dupReasonByIdx.get(i) !== "exact"));
                  setDupOpen(new Set());
                }}
              >
                {isZh ? "仅移除完全重复" : "Remove exact only"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="rounded-full"
                onClick={() => {
                  setRows((prev) => prev.filter((_, i) => dedup.dupReasonByIdx.get(i) !== "similar"));
                  setRowErrors((prev) => prev.filter((_, i) => dedup.dupReasonByIdx.get(i) !== "similar"));
                  setDupOpen(new Set());
                }}
              >
                {isZh ? "仅移除相似重复" : "Remove similar only"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <form
        action={action}
        className={`${embedded ? "mt-0" : "mt-4"} space-y-4`}
        onSubmit={(e) => {
          setError(null);
          const nextErrors = rows.map((r) => validateRow(r));
          setRowErrors(nextErrors);
          const invalidIdx = nextErrors.findIndex((x) => Object.keys(x).length > 0);
          if (invalidIdx >= 0) {
            e.preventDefault();
            const e0 = nextErrors[invalidIdx] ?? {};
            const field = e0.occurred_on ?? e0.amount ?? e0.category ?? "";
            setError(
              field
                ? t("bulkClientInvalidRow", { n: invalidIdx + 1, field })
                : t("bulkClientInvalid"),
            );
          }
        }}
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="bulk" value={payload} />
        {returnTo === "quick" ? <input type="hidden" name="return_to" value="quick" /> : null}
        {prefillDate ? <input type="hidden" name="context_date" value={prefillDate} /> : null}

        <div className="grid gap-3">
          {rows.map((row, idx) => (
            <div
              key={idx}
              className={[
                "rounded-xl border bg-white p-4",
                Object.keys(rowErrors[idx] ?? {}).length ? "border-destructive/60 ring-2 ring-destructive/20" : "",
                dedup.dupIdx.has(idx) ? "border-amber-300 ring-2 ring-amber-200/60" : "",
                flashRow === idx ? "ring-2 ring-sky-300 border-sky-300" : "",
              ].join(" ")}
              ref={(el) => {
                rowRefs.current[idx] = el;
              }}
            >
              {dedup.dupIdx.has(idx) ? (
                <div className="mb-3 text-xs text-amber-900">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      {(() => {
                        const reason = dedup.dupReasonByIdx.get(idx);
                        const of = dedup.dupOfByIdx.get(idx);
                        const baseZh =
                          reason === "similar"
                            ? "可能重复（相似）：同日期/金额，且备注/商户高度相似。"
                            : "可能重复：同日期/金额/备注（或商户）与上一条相同。";
                        const baseEn =
                          reason === "similar"
                            ? "Possible duplicate (similar): same date/amount and note/merchant looks very similar."
                            : "Possible duplicate: same date/amount/note (or merchant) as an earlier row.";
                        const withOf =
                          typeof of === "number" && of >= 0
                            ? isZh
                              ? `${baseZh}（原始：第 ${of + 1} 行）`
                              : `${baseEn} (original: row ${of + 1})`
                            : isZh
                              ? baseZh
                              : baseEn;
                        return withOf;
                      })()}
                    </div>
                    <div className="flex gap-2">
                      {(() => {
                        const of = dedup.dupOfByIdx.get(idx);
                        if (typeof of !== "number" || of < 0) return null;
                        return (
                          <button
                            type="button"
                            className="rounded-full border border-amber-300 bg-white px-3 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100"
                            onClick={() => scrollToRow(of)}
                          >
                            {isZh ? "跳转到原始行" : "Go to original"}
                          </button>
                        );
                      })()}
                      <button
                        type="button"
                        className="rounded-full border border-amber-300 bg-white px-3 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100"
                        onClick={() => {
                          setDupOpen((prev) => {
                            const next = new Set(prev);
                            if (next.has(idx)) next.delete(idx);
                            else next.add(idx);
                            return next;
                          });
                        }}
                      >
                        {dupOpen.has(idx) ? (isZh ? "收起对比" : "Hide") : isZh ? "展开对比" : "Compare"}
                      </button>
                    </div>
                  </div>

                  {dupOpen.has(idx) ? (
                    <div className="mt-2 grid gap-2 rounded-lg border border-amber-200 bg-amber-50/70 p-2 text-[11px] text-amber-950">
                      {(() => {
                        const of = dedup.dupOfByIdx.get(idx);
                        if (typeof of !== "number" || of < 0) return null;
                        const a = rows[of];
                        const b = rows[idx];
                        if (!a || !b) return null;
                        return (
                          <>
                            <div className="grid gap-1 sm:grid-cols-2">
                              <div>
                                <div className="font-medium">{isZh ? `原始（第 ${of + 1} 行）` : `Original (row ${of + 1})`}</div>
                                <div className="text-amber-900/90">{a.note || (isZh ? "（无备注）" : "(no note)")}</div>
                              </div>
                              <div>
                                <div className="font-medium">{isZh ? `当前（第 ${idx + 1} 行）` : `Current (row ${idx + 1})`}</div>
                                <div className="text-amber-900/90">{b.note || (isZh ? "（无备注）" : "(no note)")}</div>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor={`amount_${idx}`}>{t("amount")}</Label>
                  <Input
                    id={`amount_${idx}`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={row.amount}
                    onChange={(e) =>
                      setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, amount: e.target.value } : r)))
                    }
                    aria-invalid={Boolean(rowErrors[idx]?.amount)}
                  />
                  {rowErrors[idx]?.amount ? (
                    <div className="text-xs text-destructive">{t("bulkClientFieldAmount")}</div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`type_${idx}`}>{t("typeLabel")}</Label>
                  <select
                    id={`type_${idx}`}
                    value={row.type}
                    onChange={(e) => {
                      const nextType = e.target.value === "income" ? "income" : "expense";
                      setRows((prev) =>
                        prev.map((r, i) => {
                          if (i !== idx) return r;
                          const allowed =
                            nextType === "income" ? INCOME_CATEGORY_KEYS : EXPENSE_CATEGORY_KEYS;
                          let preset = r.categoryPreset;
                          if (!(allowed as readonly string[]).includes(preset) && preset !== CATEGORY_CUSTOM) {
                            preset = defaultPresetForType(nextType);
                          }
                          if (preset === CATEGORY_CUSTOM && !r.categoryCustom.trim()) {
                            preset = defaultPresetForType(nextType);
                          }
                          return {
                            ...r,
                            type: nextType,
                            categoryPreset: preset,
                          };
                        }),
                      );
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="expense">{t("typeExpense")}</option>
                    <option value="income">{t("typeIncome")}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`currency_${idx}`}>{t("currency")}</Label>
                  <select
                    id={`currency_${idx}`}
                    value={row.currency}
                    onChange={(e) => {
                      const cur = coerceCurrency(e.target.value);
                      setRows((prev) =>
                        prev.map((r, i) =>
                          i === idx
                            ? {
                                ...r,
                                currency: cur,
                                fx_rate: cur === "USD" ? "1" : r.fx_rate,
                                fx_mode: cur === "USD" ? "auto" : r.fx_mode,
                              }
                            : r,
                        ),
                      );
                      if (cur !== "USD" && row.fx_mode === "auto") {
                        fetch(`/api/fx?from=${encodeURIComponent(cur)}&to=USD`)
                          .then((r) => r.json().catch(() => ({})))
                          .then((d: unknown) => {
                            const rate = Number((d as FxApiResponse | null | undefined)?.rate);
                            if (!Number.isFinite(rate) || rate <= 0) return;
                            setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, fx_rate: String(rate) } : r)));
                          })
                          .catch(() => undefined);
                      }
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="CNY">CNY</option>
                    <option value="JPY">JPY</option>
                    <option value="GBP">GBP</option>
                    <option value="HKD">HKD</option>
                    <option value="AUD">AUD</option>
                    <option value="CAD">CAD</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bulk_display_currency">{t("fxDisplayCurrency")}</Label>
                  <select
                    value={displayCurrency}
                    onChange={(e) => setDisplayCurrency(coerceCurrency(e.target.value))}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="CNY">CNY</option>
                    <option value="JPY">JPY</option>
                    <option value="GBP">GBP</option>
                    <option value="HKD">HKD</option>
                    <option value="AUD">AUD</option>
                    <option value="CAD">CAD</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`fx_mode_${idx}`}>{t("fxMode")}</Label>
                  <select
                    id={`fx_mode_${idx}`}
                    value={fxMode}
                    onChange={(e) => setFxMode(e.target.value === "manual" ? "manual" : "auto")}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="auto">{t("fxModeAuto")}</option>
                    <option value="manual">{t("fxModeManual")}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`fx_${idx}`}>
                    {t("fxRateToUsd")}
                    <span className="ml-1 text-[11px] text-emerald-700/70">({t("fxRateHint")})</span>
                  </Label>
                  <Input
                    id={`fx_${idx}`}
                    type="number"
                    min="0"
                    step="0.0001"
                    value={row.currency === "USD" ? "1" : row.fx_rate}
                    onChange={(e) =>
                      setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, fx_rate: e.target.value } : r)))
                    }
                    placeholder="1.0"
                    required={row.currency !== "USD"}
                    disabled={row.currency === "USD" || fxMode === "auto"}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                  <Label htmlFor={`bulk_display_rate_${idx}`}>
                    {t("fxDisplayRateFromUsd")}
                    <span className="ml-1 text-[11px] text-emerald-700/70">({t("fxDisplayRateHint")})</span>
                  </Label>
                  {displayCurrency === "USD" ? (
                    <Input id={`bulk_display_rate_${idx}`} value="1" disabled className="h-9" />
                  ) : (
                    <Input
                      id={`bulk_display_rate_${idx}`}
                      type="number"
                      min="0"
                      step="0.0001"
                      value={displayRate}
                      onChange={(e) => setDisplayRate(e.target.value)}
                      disabled={fxMode === "auto"}
                      placeholder="1.0"
                      className="h-9"
                    />
                  )}
                </div>

              </div>

              <div className="mt-4 rounded-xl border bg-white p-3 text-sm">
                <div className="text-muted-foreground">{t("fxPreviewTitle")}</div>
                <div className="mt-1 font-medium">
                  {(() => {
                    const amt = Number(row.amount);
                    if (!Number.isFinite(amt) || amt <= 0 || usdToDisplay == null) return <span className="text-muted-foreground">{t("fxPreviewEmpty")}</span>;
                    const fx = row.currency === "USD" ? 1 : Number(row.fx_rate);
                    if (!Number.isFinite(fx) || fx <= 0) return <span className="text-muted-foreground">{t("fxPreviewEmpty")}</span>;
                    const usd = amt * fx;
                    const out = usd * usdToDisplay;
                    return (
                      <>
                        {out.toLocaleString("en-US", {
                          style: "currency",
                          currency: displayCurrency,
                          currencyDisplay: "code",
                        })}
                        {row.currency !== "USD" ? (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            (USD {usd.toFixed(2)} · {row.currency} {amt.toFixed(2)})
                          </span>
                        ) : null}
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Label htmlFor={`category_${idx}`}>{t("category")}</Label>
                <select
                  id={`category_${idx}`}
                  value={row.categoryPreset}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRows((prev) =>
                      prev.map((r, i) =>
                        i === idx
                          ? { ...r, categoryPreset: v, categoryCustom: v === CATEGORY_CUSTOM ? r.categoryCustom : "" }
                          : r,
                      ),
                    );
                  }}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  aria-invalid={Boolean(rowErrors[idx]?.category)}
                >
                  {(row.type === "income" ? INCOME_CATEGORY_KEYS : EXPENSE_CATEGORY_KEYS).map((k) => (
                    <option key={k} value={k}>
                      {formatCategoryLabel(k, row.type, (key) => t(key as never))}
                    </option>
                  ))}
                  <option value={CATEGORY_CUSTOM}>{t("categoryCustom")}</option>
                </select>
                {rowErrors[idx]?.category ? (
                  <div className="text-xs text-destructive">{t("bulkClientFieldCategory")}</div>
                ) : null}
                {row.categoryPreset === CATEGORY_CUSTOM ? (
                  <div className="mt-2 space-y-2">
                    <Label htmlFor={`category_custom_${idx}`}>
                      {t("categoryCustomDetail")}
                      <span className="ml-1 text-[11px] text-sky-700/70">{common("requiredInParens")}</span>
                    </Label>
                    <Input
                      id={`category_custom_${idx}`}
                      value={row.categoryCustom}
                      placeholder={t("categoryCustomPlaceholder")}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, categoryCustom: e.target.value } : r)),
                        )
                      }
                      required
                    />
                  </div>
                ) : null}
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`occurred_on_${idx}`}>{t("bulkDate")}</Label>
                  <Input
                    id={`occurred_on_${idx}`}
                    type="date"
                    value={row.occurred_on}
                    onChange={(e) =>
                      setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, occurred_on: e.target.value } : r)))
                    }
                    aria-invalid={Boolean(rowErrors[idx]?.occurred_on)}
                  />
                  {rowErrors[idx]?.occurred_on ? (
                    <div className="text-xs text-destructive">{t("bulkClientFieldDate")}</div>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`note_${idx}`}>
                    {t("note")}
                    <span className="ml-1 text-[11px] text-emerald-700/70">{common("optionalInParens")}</span>
                  </Label>
                  <Input
                    id={`note_${idx}`}
                    value={row.note}
                    onChange={(e) =>
                      setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, note: e.target.value } : r)))
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div>
          <Button type="submit" className="rounded-full">
            {t("bulkSubmit", { n: rows.length })}
          </Button>
        </div>
      </form>
    </div>
  );
}

