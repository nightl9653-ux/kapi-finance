"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/locales";

type BudgetItem = {
  budget_id: string;
  category: string;
  limit_base: number;
  pct: number | null;
  rationale: string | null;
};

type Budget = {
  id: string;
  month: string;
  currency: string;
  note: string | null;
  items: BudgetItem[];
};

/** 金额容差：避免 220/220 被判成「超过」（仅在 spent > limit 时才算超出） */
const MONEY_EPS = 0.01;

function progressState(used: number, limit: number): "ok" | "near" | "atLimit" | "over" {
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return "ok";
  if (used > limit + MONEY_EPS) return "over";
  if (used >= limit - MONEY_EPS) return "atLimit";
  const ratio = used / limit;
  if (ratio >= 0.8) return "near";
  return "ok";
}

export function BudgetPlanCard({
  locale,
  initial,
  initialSpent,
}: {
  locale: Locale;
  initial: Budget | null;
  initialSpent: Record<string, number>;
}) {
  const t = useTranslations("aiAssistantPage");
  const [budget, setBudget] = useState<Budget | null>(initial);
  const [spentByCategory, setSpentByCategory] = useState<Record<string, number>>(initialSpent);
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    setBudget(initial);
  }, [initial]);

  useEffect(() => {
    setSpentByCategory(initialSpent);
  }, [initialSpent]);

  const fmt = useMemo(() => {
    return new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [locale]);

  const totalLimit = useMemo(() => {
    const xs = budget?.items ?? [];
    return xs.reduce((acc, it) => acc + (Number.isFinite(it.limit_base) ? Number(it.limit_base) : 0), 0);
  }, [budget]);

  const trackedSpentTotal = useMemo(() => {
    if (!budget) return 0;
    let s = 0;
    for (const it of budget.items) {
      s += spentByCategory[it.category] ?? 0;
    }
    return s;
  }, [budget, spentByCategory]);

  const generate = useCallback(async () => {
    if (pending) return;
    setPending(true);
    setErrorKey(null);
    try {
      const res = await fetch("/api/budgets/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, month: budget?.month ?? null }),
      });
      const data = (await res.json().catch(() => null)) as null | {
        ok?: boolean;
        error?: string;
        budget?: Budget;
        spentByCategory?: Record<string, number>;
      };
      if (!res.ok || !data?.ok || !data.budget) {
        setErrorKey(data?.error ?? "unknown");
        return;
      }
      setBudget(data.budget);
      if (data.spentByCategory && typeof data.spentByCategory === "object") {
        setSpentByCategory(data.spentByCategory);
      }
    } catch {
      setErrorKey("network");
    } finally {
      setPending(false);
    }
  }, [pending, locale, budget?.month]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-base font-medium">{t("budget.title")}</div>
          <div className="text-sm text-muted-foreground">{t("budget.subtitle")}</div>
        </div>
        <Button type="button" className="rounded-full" disabled={pending} onClick={() => void generate()}>
          {pending ? t("budget.generating") : budget ? t("budget.regenerate") : t("budget.generate")}
        </Button>
      </div>

      {errorKey ? (
        <p className="text-sm text-destructive">
          {t(`budget.errors.${errorKey}` as never) || t("budget.errors.unknown")}
        </p>
      ) : null}

      {budget ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="text-muted-foreground">
              {t("budget.month")}: <span className="font-medium text-foreground">{budget.month}</span>
            </div>
            <div className="text-muted-foreground">
              {t("budget.total")}: <span className="font-medium text-foreground">{fmt.format(totalLimit)}</span>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            {t("budget.progress.trackedMonthSpend", { amount: fmt.format(trackedSpentTotal) })}
          </div>

          {budget.note ? (
            <div className="rounded-lg border bg-white/70 p-3 text-sm text-muted-foreground whitespace-pre-wrap">
              {budget.note}
            </div>
          ) : null}

          <div className="divide-y rounded-xl border bg-white/70">
            {budget.items.map((it, idx) => {
              const limit = Number(it.limit_base);
              const used = spentByCategory[it.category] ?? 0;
              const ratio = limit > 0 && Number.isFinite(limit) ? used / limit : 0;
              const state = progressState(used, limit);
              const barPct = Math.min(100, ratio * 100);
              const toneLabel =
                state === "over"
                  ? t("budget.progress.statusOver")
                  : state === "atLimit"
                    ? t("budget.progress.statusAtLimit")
                    : state === "near"
                      ? t("budget.progress.statusNear")
                      : t("budget.progress.statusOk");

              return (
                <div key={`${it.category}-${idx}`} className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{it.category}</div>
                      {it.rationale ? (
                        <div className="text-xs text-muted-foreground whitespace-pre-wrap">{it.rationale}</div>
                      ) : null}
                    </div>
                    <div className={cn("shrink-0 text-right text-sm tabular-nums")}>
                      <div className="font-semibold">
                        <span className="text-foreground">{fmt.format(used)}</span>
                        <span className="mx-1 text-muted-foreground">/</span>
                        <span className="text-muted-foreground">{fmt.format(limit)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {typeof it.pct === "number" ? `(${it.pct.toFixed(1)}%) · ` : null}
                        {toneLabel}
                      </div>
                    </div>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-2 rounded-full transition-[width]",
                        state === "over" && "bg-red-500",
                        (state === "near" || state === "atLimit") && "bg-amber-500",
                        state === "ok" && "bg-emerald-600",
                      )}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("budget.empty")}</p>
      )}
    </div>
  );
}
