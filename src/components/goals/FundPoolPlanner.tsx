"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Currency } from "@/lib/fx";

type GoalLite = { id: string; name: string };

type SavedState = {
  poolBaseUsd: number;
  savingsRatePct: number;
  goalRatesPct: Record<string, number>;
};

const STORAGE_KEY = "kapi:fundPoolPlanner:v1";

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function formatPct(n: number): string {
  const x = clampPct(n);
  return Number.isFinite(x) ? String(x) : "0";
}

export function FundPoolPlanner({
  goals,
  netMonthUsd,
  displayCurrency,
  usdToDisplay,
}: {
  goals: GoalLite[];
  netMonthUsd: number;
  displayCurrency: Currency;
  usdToDisplay: number;
}) {
  const t = useTranslations("goals");

  const [poolBaseUsd, setPoolBaseUsd] = useState<number>(0);
  const [savingsRatePct, setSavingsRatePct] = useState<number>(20);
  const [goalRatesPct, setGoalRatesPct] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<SavedState> | null;
      if (!parsed) return;
      queueMicrotask(() => {
        if (typeof parsed.poolBaseUsd === "number") setPoolBaseUsd(parsed.poolBaseUsd);
        if (typeof parsed.savingsRatePct === "number") setSavingsRatePct(clampPct(parsed.savingsRatePct));
        if (parsed.goalRatesPct && typeof parsed.goalRatesPct === "object") {
          setGoalRatesPct(
            Object.fromEntries(
              Object.entries(parsed.goalRatesPct as Record<string, unknown>)
                .map(([k, v]) => [k, typeof v === "number" ? clampPct(v) : 0]),
            ),
          );
        }
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const payload: SavedState = {
      poolBaseUsd: Number.isFinite(poolBaseUsd) ? poolBaseUsd : 0,
      savingsRatePct: clampPct(savingsRatePct),
      goalRatesPct: Object.fromEntries(
        goals.map((g) => [g.id, clampPct(goalRatesPct[g.id] ?? 0)]),
      ),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [poolBaseUsd, savingsRatePct, goalRatesPct, goals]);

  const sumGoalRates = useMemo(() => {
    return goals.reduce((acc, g) => acc + clampPct(goalRatesPct[g.id] ?? 0), 0);
  }, [goals, goalRatesPct]);

  const net = Number.isFinite(netMonthUsd) ? netMonthUsd : 0;
  const savings = net * (clampPct(savingsRatePct) / 100);
  const allocatedToGoals = net * (sumGoalRates / 100);
  const reserve = net - savings - allocatedToGoals;
  const reservePctOfNet = net !== 0 ? (reserve / net) * 100 : 0;
  const totalPlannedPct = clampPct(savingsRatePct) + sumGoalRates;
  const overPct = totalPlannedPct - 100;

  const money = useMemo(() => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: displayCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [displayCurrency]);

  const fmt = (usd: number) => money.format(usd * usdToDisplay);

  return (
    <div className="rounded-2xl border bg-white/70 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{t("fundPoolTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("fundPoolSubtitle")}</p>
        </div>
        <div className="text-right text-sm">
          <div className="text-muted-foreground">{t("fundPoolNetMonth")}</div>
          <div className="font-semibold">{fmt(net)}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fund_pool_savings_rate">{t("fundPoolSavingsRate")}</Label>
          <Input
            id="fund_pool_savings_rate"
            type="number"
            min="0"
            max="100"
            step="1"
            value={formatPct(savingsRatePct)}
            onChange={(e) => setSavingsRatePct(Number(e.target.value))}
          />
          <div className="text-xs text-muted-foreground">{t("fundPoolSavingsRateHint")}</div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fund_pool_base">{t("fundPoolBalance")}</Label>
          <Input
            id="fund_pool_base"
            type="number"
            step="0.01"
            value={Number.isFinite(poolBaseUsd) ? String(poolBaseUsd) : "0"}
            onChange={(e) => setPoolBaseUsd(Number(e.target.value))}
          />
          <div className="text-xs text-muted-foreground">{t("fundPoolBalanceHint")}</div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border bg-white p-4 text-sm">
        <div className="grid gap-2 sm:grid-cols-4">
          <div>
            <div className="text-muted-foreground">{t("fundPoolHardSavings")}</div>
            <div className="mt-1 font-semibold">{fmt(savings)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{t("fundPoolRemainder")}</div>
            <div className="mt-1 font-semibold">{fmt(allocatedToGoals)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{t("fundPoolReserve")}</div>
            <div className="mt-1 font-semibold">
              {fmt(reserve)}
              <span className={`ml-2 text-xs font-normal ${reservePctOfNet < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                ({Math.round(reservePctOfNet)}%)
              </span>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">{t("fundPoolProjectedBalance")}</div>
            <div className="mt-1 font-semibold">{fmt(poolBaseUsd + net)}</div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium">{t("fundPoolGoalAllocTitle")}</div>
          <div className={`text-xs ${sumGoalRates > 100 ? "text-destructive" : "text-muted-foreground"}`}>
            {t("fundPoolGoalAllocSum", { n: Math.round(sumGoalRates) })}
          </div>
        </div>
        {overPct > 0 ? (
          <div className="mt-2 text-xs text-destructive">
            {t("fundPoolOverLimit", { n: Math.round(overPct) })}
          </div>
        ) : null}

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {goals.length ? (
            goals.map((g) => {
              const pct = clampPct(goalRatesPct[g.id] ?? 0);
              const allocUsd = net * (pct / 100);
              return (
                <div key={g.id} className="rounded-xl border bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{g.name}</div>
                      <div className="text-xs text-muted-foreground">{t("fundPoolAllocPreview", { amt: fmt(allocUsd) })}</div>
                    </div>
                    <div className="w-[120px]">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={formatPct(pct)}
                        onChange={(e) =>
                          setGoalRatesPct((prev) => ({ ...prev, [g.id]: Number(e.target.value) }))
                        }
                      />
                      <div className="mt-1 text-right text-[11px] text-muted-foreground">%</div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-sm text-muted-foreground">{t("fundPoolNoGoals")}</div>
          )}
        </div>
      </div>
    </div>
  );
}

