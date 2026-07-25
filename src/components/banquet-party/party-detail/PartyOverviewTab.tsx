"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { daysUntilParty, getGuestHeadcount, getPartyBudgetSummary } from "@/lib/banquet-party/budget";
import { loadPartyLinkedSpend } from "@/lib/banquet-party/log-expense";
import type { Party } from "@/lib/banquet-party/types";
import { BASE_CURRENCY, coerceCurrency, formatProjectMoney } from "@/lib/fx";

export function PartyOverviewTab({
  party,
  onGoPrep,
  onGoGuests,
  onGoTimeline,
  onComplete,
}: {
  party: Party;
  onGoPrep: () => void;
  onGoGuests: () => void;
  onGoTimeline: () => void;
  onComplete: () => void;
}) {
  const t = useTranslations("banquetParty");
  const budget = getPartyBudgetSummary(party);
  const currency = coerceCurrency(party.currency ?? BASE_CURRENCY);
  const guests = getGuestHeadcount(party);
  const days = daysUntilParty(party.date);
  const timeline = party.timeline ?? [];
  const timelinePending = timeline.filter((task) => !task.done).length;
  const [linkedSpend, setLinkedSpend] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadPartyLinkedSpend(party.id).then((n) => {
      if (!cancelled) setLinkedSpend(n);
    });
    return () => {
      cancelled = true;
    };
  }, [party.id, party.materials]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border bg-white/80 p-4">
          <p className="text-xs text-muted-foreground">{t("overviewBudget")}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{formatProjectMoney(budget.totalPlanned, currency, { digits: 0 })}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("overviewPurchased", {
              amount: formatProjectMoney(budget.totalPurchased, currency, { digits: 0 }),
              pending: budget.totalPending,
            })}
          </p>
          {linkedSpend != null && linkedSpend > 0 ? (
            <p className="mt-1 text-xs text-emerald-800">
              {t("overviewLinkedSpend", { amount: formatProjectMoney(linkedSpend, currency, { digits: 0 }) })}
            </p>
          ) : null}
          <button type="button" className="mt-2 text-xs text-foreground underline" onClick={onGoPrep}>
            {t("overviewViewBudget")}
          </button>
        </div>
        <div className="rounded-2xl border bg-white/80 p-4">
          <p className="text-xs text-muted-foreground">{t("overviewGuests")}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {t("overviewGuestCount", { confirmed: guests.confirmed, total: guests.total })}
          </p>
          <button type="button" className="mt-2 text-xs text-foreground underline" onClick={onGoGuests}>
            {t("overviewManageGuests")}
          </button>
        </div>
      </div>

      {budget.budgetCap != null && budget.budgetCap > 0 ? (
        <div className={`rounded-2xl border p-4 ${budget.overCap ? "border-amber-300 bg-amber-50" : "bg-white/80"}`}>
          <p className="text-xs text-muted-foreground">{t("budgetCap")}</p>
          <p className="mt-1 font-medium tabular-nums">
            {formatProjectMoney(budget.budgetCap, currency)}
            {budget.overCap
              ? ` · ${t("overCap")}`
              : budget.remaining != null
                ? ` · ${t("budgetRemaining", { amount: formatProjectMoney(budget.remaining, currency) })}`
                : ""}
          </p>
          {budget.overCap ? (
            <p className="mt-1 text-xs text-amber-900">
              {t("overCapDetail", {
                over: formatProjectMoney(budget.totalPlanned - budget.budgetCap, currency),
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-2xl border bg-gradient-to-br from-[#F4EFEA] to-[#FAF9F7] p-4">
        <p className="text-sm font-medium">{t("overviewCountdown")}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {days > 0 ? t("overviewDaysLeft", { n: days }) : days === 0 ? t("overviewToday") : t("overviewPast")}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("overviewTimelinePending", { n: timelinePending })}
          {timelinePending > 0 ? (
            <button type="button" className="ml-2 underline" onClick={onGoTimeline}>
              {t("overviewViewTimeline")}
            </button>
          ) : null}
        </p>
      </div>

      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm leading-relaxed text-amber-950/90">
        {t("workflowHint")}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="text-sm text-foreground underline-offset-4 hover:underline" onClick={onGoPrep}>
          {t("overviewViewBudget")}
        </button>
        {party.materials.length > 0 && !party.completedAt ? (
          <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={onComplete}>
            {t("completeParty")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
