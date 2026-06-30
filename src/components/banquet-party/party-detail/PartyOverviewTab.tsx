"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { daysUntilParty, getGuestHeadcount, getPartyBudgetSummary } from "@/lib/banquet-party/budget";
import type { Party } from "@/lib/banquet-party/types";

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
  const locale = useLocale();
  const budget = getPartyBudgetSummary(party);
  const guests = getGuestHeadcount(party);
  const days = daysUntilParty(party.date);
  const timeline = party.timeline ?? [];
  const timelinePending = timeline.filter((task) => !task.done).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border bg-white/80 p-4">
          <p className="text-xs text-muted-foreground">{t("overviewBudget")}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">¥{budget.totalPlanned.toFixed(0)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("overviewPurchased", { amount: budget.totalPurchased.toFixed(0), pending: budget.totalPending })}
          </p>
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

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/${locale}/transactions`}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {t("linkTransactions")}
        </Link>
        {party.materials.length > 0 && !party.completedAt ? (
          <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={onComplete}>
            {t("completeParty")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
