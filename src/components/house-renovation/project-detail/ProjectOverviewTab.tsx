"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import {
  capRatio,
  getPhaseTimeline,
  getScheduleStatus,
  type ProjectBudgetSummary,
} from "@/lib/house-renovation/budget";
import { categoryLabel, phaseLabel, projectTypeLabel } from "@/lib/house-renovation/labels";
import { loadProjectLinkedSpend } from "@/lib/house-renovation/log-expense";
import type { RenovationProject } from "@/lib/house-renovation/types";
import { BASE_CURRENCY, coerceCurrency, formatProjectMoney } from "@/lib/fx";
import { cn } from "@/lib/utils";

function ProgressBar({
  ratio,
  tone,
}: {
  ratio: number;
  tone: "ok" | "warn" | "danger";
}) {
  const pct = Math.min(100, Math.max(0, ratio * 100));
  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted/60">
      <div
        className={cn(
          "h-full rounded-full transition-[width]",
          tone === "danger" ? "bg-red-500" : tone === "warn" ? "bg-amber-500" : "bg-emerald-600",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function toneForRatio(ratio: number | null): "ok" | "warn" | "danger" {
  if (ratio == null) return "ok";
  if (ratio > 1) return "danger";
  if (ratio >= 0.9) return "warn";
  return "ok";
}

export function ProjectOverviewTab({
  project,
  budget,
}: {
  project: RenovationProject;
  budget: ProjectBudgetSummary;
}) {
  const t = useTranslations("houseRenovation");
  const currency = coerceCurrency(project.currency ?? BASE_CURRENCY);
  const [linkedSpend, setLinkedSpend] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadProjectLinkedSpend(project.id).then((n) => {
      if (!cancelled) setLinkedSpend(n);
    });
    return () => {
      cancelled = true;
    };
  }, [project.id, project.materials]);

  const actualSpend = linkedSpend != null && linkedSpend > 0 ? linkedSpend : budget.totalLogged;
  const plannedRatio = capRatio(budget.totalPlanned, budget.budgetCap);
  const actualRatio = capRatio(actualSpend, budget.budgetCap);
  const overCapActual = budget.budgetCap != null && actualSpend > budget.budgetCap;
  const schedule = useMemo(() => getScheduleStatus(project.targetEndDate), [project.targetEndDate]);
  const phaseTimeline = useMemo(() => getPhaseTimeline(project), [project]);

  const alerts: string[] = [];
  if (budget.overCapPlanned && budget.budgetCap) {
    alerts.push(
      t("alertOverPlanned", {
        over: formatProjectMoney(budget.totalPlanned - budget.budgetCap, currency),
      }),
    );
  }
  if (overCapActual && budget.budgetCap) {
    alerts.push(
      t("alertOverActual", {
        over: formatProjectMoney(actualSpend - budget.budgetCap, currency),
      }),
    );
  }
  if (schedule.kind === "overdue") {
    alerts.push(t("alertOverdue", { n: schedule.days }));
  } else if (schedule.kind === "dueToday") {
    alerts.push(t("alertDueToday"));
  } else if (schedule.kind === "daysLeft" && schedule.days <= 7) {
    alerts.push(t("alertDaysLeft", { n: schedule.days }));
  }
  if (project.currentPhase) {
    alerts.push(t("alertCurrentPhase", { phase: phaseLabel(t, project.currentPhase) }));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm leading-relaxed text-amber-950/90">
        {t("workflowHint")}
      </div>

      {alerts.length > 0 ? (
        <div
          className={cn(
            "rounded-2xl border px-4 py-3 text-sm",
            budget.overCapPlanned || overCapActual || schedule.kind === "overdue"
              ? "border-amber-300 bg-amber-50 text-amber-950"
              : "border-sky-200 bg-sky-50/80 text-sky-950",
          )}
        >
          <p className="text-xs font-medium text-muted-foreground">{t("alertsTitle")}</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            {alerts.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border bg-white/80 p-4">
          <p className="text-xs text-muted-foreground">{t("totalPlanned")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatProjectMoney(budget.totalPlanned, currency)}
          </p>
        </div>
        <div className="rounded-2xl border bg-white/80 p-4">
          <p className="text-xs text-muted-foreground">{t("totalPurchased")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700">
            {formatProjectMoney(budget.totalPurchased, currency)}
          </p>
          {actualSpend > 0 ? (
            <p className="mt-1 text-xs text-emerald-800">
              {t("overviewLinkedSpend", { amount: formatProjectMoney(actualSpend, currency, { digits: 0 }) })}
            </p>
          ) : null}
        </div>
      </div>

      {budget.budgetCap != null ? (
        <div className="space-y-3 rounded-2xl border bg-white/80 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium">{t("budgetProgressTitle")}</p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {t("budgetCap")}: {formatProjectMoney(budget.budgetCap, currency)}
            </p>
          </div>

          <div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{t("progressPlanned")}</span>
              <span className="tabular-nums">
                {formatProjectMoney(budget.totalPlanned, currency)}
                {plannedRatio != null ? ` · ${Math.round(plannedRatio * 100)}%` : ""}
                {budget.overCapPlanned ? ` · ${t("overCapPlannedShort")}` : ""}
              </span>
            </div>
            <ProgressBar ratio={plannedRatio ?? 0} tone={toneForRatio(plannedRatio)} />
          </div>

          <div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{t("progressActual")}</span>
              <span className="tabular-nums">
                {formatProjectMoney(actualSpend, currency)}
                {actualRatio != null ? ` · ${Math.round(actualRatio * 100)}%` : ""}
                {overCapActual ? ` · ${t("overCapActualShort")}` : ""}
              </span>
            </div>
            <ProgressBar ratio={actualRatio ?? 0} tone={toneForRatio(actualRatio)} />
          </div>
        </div>
      ) : null}

      {budget.costPerSqm != null ? (
        <p className="text-sm text-muted-foreground">
          {t("costPerSqm", { amount: formatProjectMoney(budget.costPerSqm, currency, { digits: 0 }) })}
        </p>
      ) : null}

      <div className="rounded-2xl border bg-white/80 p-4 text-sm">
        <p>
          <span className="text-muted-foreground">{t("pickProjectType")}：</span>
          {projectTypeLabel(t, project.projectType)}
        </p>
        {project.address ? (
          <p className="mt-1">
            <span className="text-muted-foreground">{t("address")}：</span>
            {project.address}
          </p>
        ) : null}
        {project.startDate || project.targetEndDate ? (
          <p className="mt-1">
            <span className="text-muted-foreground">{t("dateRange")}：</span>
            {project.startDate ?? "—"} → {project.targetEndDate ?? "—"}
            {schedule.kind === "daysLeft"
              ? ` · ${t("scheduleDaysLeft", { n: schedule.days })}`
              : schedule.kind === "dueToday"
                ? ` · ${t("scheduleDueToday")}`
                : schedule.kind === "overdue"
                  ? ` · ${t("scheduleOverdue", { n: schedule.days })}`
                  : ""}
          </p>
        ) : null}
        {project.currentPhase ? (
          <p className="mt-1">
            <span className="text-muted-foreground">{t("currentPhase")}：</span>
            {phaseLabel(t, project.currentPhase)}
          </p>
        ) : null}
      </div>

      <div className="space-y-3 rounded-2xl border bg-white/80 p-4">
        <p className="text-sm font-medium">{t("phaseProgressTitle")}</p>
        <div className="flex flex-wrap gap-1.5">
          {phaseTimeline.map((p) => (
            <span
              key={p.phase}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px]",
                p.isCurrent
                  ? "border-foreground bg-foreground text-background"
                  : p.itemCount > 0
                    ? "bg-muted/30 text-foreground"
                    : "text-muted-foreground",
              )}
            >
              {phaseLabel(t, p.phase)}
            </span>
          ))}
        </div>
        <ul className="space-y-3">
          {phaseTimeline
            .filter((p) => p.itemCount > 0 || p.isCurrent)
            .map((p) => (
              <li key={`bar-${p.phase}`}>
                <div className="flex justify-between text-xs">
                  <span className={cn(p.isCurrent && "font-medium")}>
                    {phaseLabel(t, p.phase)}
                    {p.isCurrent ? ` · ${t("phaseCurrentTag")}` : ""}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {t("phaseLoggedCount", { done: p.loggedCount, total: p.itemCount })}
                    {p.planned > 0
                      ? ` · ${formatProjectMoney(p.purchased, currency, { digits: 0 })} / ${formatProjectMoney(p.planned, currency, { digits: 0 })}`
                      : ""}
                  </span>
                </div>
                <ProgressBar
                  ratio={p.progress}
                  tone={p.progress >= 1 && p.itemCount > 0 ? "ok" : p.isCurrent ? "warn" : "ok"}
                />
              </li>
            ))}
        </ul>
      </div>

      {budget.byCategory.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">{t("byCategory")}</h3>
          <ul className="space-y-2">
            {budget.byCategory.map((c) => (
              <li key={c.category} className="flex justify-between rounded-xl border bg-white/60 px-3 py-2 text-sm">
                <span>{categoryLabel(t, c.category)}</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatProjectMoney(c.purchased, currency, { digits: 0 })} /{" "}
                  {formatProjectMoney(c.planned, currency, { digits: 0 })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {budget.byPhase.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">{t("byPhase")}</h3>
          <ul className="space-y-2">
            {budget.byPhase.map((p) => (
              <li key={p.phase} className="flex justify-between rounded-xl border bg-white/60 px-3 py-2 text-sm">
                <span>{phaseLabel(t, p.phase)}</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatProjectMoney(p.purchased, currency, { digits: 0 })} /{" "}
                  {formatProjectMoney(p.planned, currency, { digits: 0 })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
