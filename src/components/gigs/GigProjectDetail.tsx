"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { NudgeControls } from "@/components/gigs/NudgeControls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatProjectMoney } from "@/lib/fx";
import { logGigCostExpense, logGigInstallmentIncome } from "@/lib/gigs/log-ledger";
import {
  formatTimeQuantity,
  installmentOutstanding,
  nudgeInstallment,
  projectContractTotal,
  projectCostTotal,
  projectProfit,
  projectReceivableTotal,
  projectReceivedTotal,
  projectTimeCost,
  projectTimeQuantity,
  timeEntryCost,
  timeUnitForVertical,
} from "@/lib/gigs/money";
import { gigsErrorCode, upsertProject } from "@/lib/gigs/storage";
import {
  isoToday,
  newGigId,
  type GigClient,
  type GigCost,
  type GigInstallment,
  type GigProject,
  type GigTimeLog,
  type GigsStore,
} from "@/lib/gigs/types";

export function GigProjectDetail({
  project,
  client,
  userId,
  onBack,
  onStore,
}: {
  project: GigProject;
  client: GigClient | undefined;
  userId: string;
  onBack: () => void;
  onStore: (store: GigsStore) => void;
}) {
  const t = useTranslations("gigs");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [costName, setCostName] = useState("");
  const [costAmount, setCostAmount] = useState("");
  const [timeQty, setTimeQty] = useState("");
  const [timeRate, setTimeRate] = useState("");
  const [timeNote, setTimeNote] = useState("");

  function saveErrorText(err: unknown): string {
    const code = gigsErrorCode(err);
    if (code === "time_schema") return t("timeSchemaMissing");
    if (code === "schema") return t("schemaMissing");
    return t("saveError");
  }

  async function persist(next: GigProject) {
    setBusy(true);
    setError(null);
    try {
      onStore(await upsertProject(userId, { ...next, updatedAt: new Date().toISOString() }));
    } catch (err) {
      setError(saveErrorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function markPaid(inst: GigInstallment, alsoLedger: boolean) {
    const outstanding = installmentOutstanding(inst);
    if (outstanding <= 0) return;
    const paidOn = isoToday();
    let transactionId = inst.transactionId;
    if (alsoLedger) {
      setBusy(true);
      setError(null);
      const res = await logGigInstallmentIncome({
        projectId: project.id,
        projectName: project.name,
        clientName: client?.name || project.name,
        installmentLabel: inst.label,
        amount: outstanding,
        currency: project.currency,
        occurredOn: paidOn,
        locale,
      });
      setBusy(false);
      if (!res.ok) {
        setError(res.error === "schema_missing" ? t("schemaMissing") : t("ledgerError"));
        return;
      }
      transactionId = res.transactionId;
    }
    const nextInst: GigInstallment = {
      ...inst,
      status: "paid",
      paidAmount: inst.amount,
      paidOn,
      transactionId,
    };
    await persist({
      ...project,
      installments: project.installments.map((i) => (i.id === inst.id ? nextInst : i)),
    });
  }

  async function addCost() {
    const amount = Number(costAmount);
    const name = costName.trim();
    if (!name || !Number.isFinite(amount) || amount <= 0) return;
    const cost: GigCost = {
      id: newGigId(),
      name,
      amount,
      occurredOn: isoToday(),
    };
    setCostName("");
    setCostAmount("");
    await persist({ ...project, costs: [...project.costs, cost] });
  }

  async function addTime() {
    const quantity = Number(timeQty);
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    const rateNum = Number(timeRate);
    const entry: GigTimeLog = {
      id: newGigId(),
      quantity,
      occurredOn: isoToday(),
      note: timeNote.trim() || undefined,
      rate: Number.isFinite(rateNum) && rateNum > 0 ? rateNum : undefined,
    };
    setTimeQty("");
    setTimeRate("");
    setTimeNote("");
    await persist({ ...project, timeLogs: [...(project.timeLogs ?? []), entry] });
  }

  async function removeTime(id: string) {
    await persist({
      ...project,
      timeLogs: (project.timeLogs ?? []).filter((entry) => entry.id !== id),
    });
  }

  async function logCost(cost: GigCost) {
    if (cost.transactionId) return;
    setBusy(true);
    setError(null);
    const res = await logGigCostExpense({
      projectId: project.id,
      projectName: project.name,
      costName: cost.name,
      amount: cost.amount,
      currency: project.currency,
      occurredOn: cost.occurredOn || isoToday(),
      locale,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error === "schema_missing" ? t("schemaMissing") : t("ledgerError"));
      return;
    }
    await persist({
      ...project,
      costs: project.costs.map((c) => (c.id === cost.id ? { ...c, transactionId: res.transactionId } : c)),
    });
  }

  const money = (n: number) => formatProjectMoney(n, project.currency);
  const sessions = timeUnitForVertical(project.vertical) === "sessions";
  const timeUnit = sessions ? t("timeUnitSessions") : t("timeUnitHours");
  const timeQtyTotal = projectTimeQuantity(project);
  const timeCostTotal = projectTimeCost(project);
  const timeTitle = sessions
    ? t("timeTitleSessions")
    : project.vertical === "development"
      ? t("timeTitleHours")
      : t("timeTitleHoursOptional");
  const timeHint = sessions
    ? t("timeHintSessions")
    : project.vertical === "development"
      ? t("timeHintHours")
      : t("timeHintHoursOptional");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" className="text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={onBack}>
            {t("backToList")}
          </button>
          <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight">{project.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {client?.name ?? t("unknownClient")} · {t(`verticals.${project.vertical}`)} · {t(`statuses.${project.status}`)}
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-4">
        <SummaryCard label={t("contractTotal")} value={money(projectContractTotal(project))} />
        <SummaryCard label={t("received")} value={money(projectReceivedTotal(project))} tone="emerald" />
        <SummaryCard label={t("receivable")} value={money(projectReceivableTotal(project))} tone="amber" />
        <SummaryCard
          label={timeCostTotal > 0 ? t("profitWithTime") : t("profit")}
          value={money(projectProfit(project))}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {t("costTotal")}: {money(projectCostTotal(project))}
        {timeQtyTotal > 0 ? ` · ${t("timeInvested", { qty: formatTimeQuantity(timeQtyTotal), unit: timeUnit })}` : ""}
        {timeCostTotal > 0 ? ` · ${t("timeCost")}: ${money(timeCostTotal)}` : ""}
      </p>

      <section className="space-y-3">
        <h3 className="text-base font-medium">{t("installments")}</h3>
        <ul className="space-y-2">
          {project.installments.map((inst) => {
            const left = installmentOutstanding(inst);
            return (
              <li key={inst.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white/70 px-4 py-3">
                <div>
                  <p className="font-medium">{inst.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {money(inst.amount)}
                    {inst.dueOn ? ` · ${t("dueOn")} ${inst.dueOn}` : ""}
                    {` · ${t(`installmentStatus.${inst.status}`)}`}
                    {left > 0 ? ` · ${t("outstanding")} ${money(left)}` : ""}
                    {inst.lastNudgedOn ? ` · ${t("nudgedOn", { date: inst.lastNudgedOn })}` : ""}
                    {inst.nextNudgeOn ? ` · ${t("nextNudge", { date: inst.nextNudgeOn })}` : ""}
                  </p>
                </div>
                {left > 0 ? (
                  <div className="flex flex-col items-stretch gap-2 sm:items-end">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" className="rounded-full" disabled={busy} onClick={() => void markPaid(inst, false)}>
                        {t("markPaid")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        disabled={busy}
                        onClick={() => void markPaid(inst, true)}
                      >
                        {t("markPaidAndLedger")}
                      </Button>
                    </div>
                    <NudgeControls
                      rowKey={inst.id}
                      nextNudgeOn={inst.nextNudgeOn}
                      disabled={busy}
                      onMarkNudged={(nextOn) =>
                        void persist(nudgeInstallment(project, inst.id, nextOn, isoToday()))
                      }
                    />
                  </div>
                ) : inst.transactionId ? (
                  <span className="text-xs text-emerald-800">{t("onLedger")}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-medium">{timeTitle}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{timeHint}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-white/50 p-3">
          <div className="space-y-1">
            <Label htmlFor="gig-time-qty">{t("timeQuantity")}</Label>
            <Input
              id="gig-time-qty"
              type="number"
              min={0}
              step="0.01"
              value={timeQty}
              onChange={(e) => setTimeQty(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gig-time-rate">{sessions ? t("timeRateSessions") : t("timeRateHours")}</Label>
            <Input
              id="gig-time-rate"
              type="number"
              min={0}
              step="0.01"
              value={timeRate}
              onChange={(e) => setTimeRate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gig-time-note">{t("timeNote")}</Label>
            <Input id="gig-time-note" value={timeNote} onChange={(e) => setTimeNote(e.target.value)} />
          </div>
          <Button type="button" className="rounded-full" disabled={busy} onClick={() => void addTime()}>
            {sessions ? t("addTimeSessions") : t("addTimeHours")}
          </Button>
        </div>
        <ul className="space-y-2">
          {(project.timeLogs ?? []).length === 0 ? (
            <li className="text-sm text-muted-foreground">{sessions ? t("timeEmptySessions") : t("timeEmptyHours")}</li>
          ) : (
            (project.timeLogs ?? []).map((entry) => {
              const entryCost = timeEntryCost(entry);
              return (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white/70 px-4 py-3">
                  <div>
                    <p className="font-medium">
                      {formatTimeQuantity(entry.quantity)} {timeUnit}
                      {entry.note ? ` · ${entry.note}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.occurredOn ? `${entry.occurredOn} · ` : ""}
                      {entryCost > 0
                        ? `${t("timeCost")} ${money(entryCost)}`
                        : t("timeNotInProfit")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={busy}
                    onClick={() => void removeTime(entry.id)}
                  >
                    {t("deleteTime")}
                  </Button>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-medium">{t("costs")}</h3>
        <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-white/50 p-3">
          <div className="space-y-1">
            <Label htmlFor="gig-cost-name">{t("costName")}</Label>
            <Input id="gig-cost-name" value={costName} onChange={(e) => setCostName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gig-cost-amount">{t("amount")}</Label>
            <Input
              id="gig-cost-amount"
              type="number"
              min={0}
              step="0.01"
              value={costAmount}
              onChange={(e) => setCostAmount(e.target.value)}
            />
          </div>
          <Button type="button" className="rounded-full" disabled={busy} onClick={() => void addCost()}>
            {t("addCost")}
          </Button>
        </div>
        <ul className="space-y-2">
          {project.costs.length === 0 ? (
            <li className="text-sm text-muted-foreground">{t("costsEmpty")}</li>
          ) : (
            project.costs.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white/70 px-4 py-3">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {money(c.amount)}
                    {c.occurredOn ? ` · ${c.occurredOn}` : ""}
                  </p>
                </div>
                {c.transactionId ? (
                  <span className="text-xs text-emerald-800">{t("onLedger")}</span>
                ) : (
                  <Button type="button" size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => void logCost(c)}>
                    {t("logToLedger")}
                  </Button>
                )}
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "amber";
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200/80 bg-emerald-50/50 text-emerald-950"
      : tone === "amber"
        ? "border-amber-200/80 bg-amber-50/40 text-amber-950"
        : "bg-white/70";
  return (
    <div className={`rounded-2xl border p-3 ${toneClass}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
