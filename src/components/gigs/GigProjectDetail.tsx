"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { GigProjectForm } from "@/components/gigs/GigProjectForm";
import { GigQuoteSheet } from "@/components/gigs/GigQuoteSheet";
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
  projectTimeQuantity,
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
  clients,
  userId,
  onBack,
  onStore,
}: {
  project: GigProject;
  client: GigClient | undefined;
  clients: GigClient[];
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
  const [timeNote, setTimeNote] = useState("");
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState(false);
  const [showingQuote, setShowingQuote] = useState(false);
  const [editingInstallmentId, setEditingInstallmentId] = useState<string | null>(null);
  const [editingCostId, setEditingCostId] = useState<string | null>(null);
  const [instLabel, setInstLabel] = useState("");
  const [instAmount, setInstAmount] = useState("");
  const [instDueOn, setInstDueOn] = useState("");

  function saveErrorText(err: unknown): string {
    const code = gigsErrorCode(err);
    if (code === "time_schema") return t("timeSchemaMissing");
    if (code === "schema") return t("schemaMissing");
    return t("saveError");
  }

  async function persist(next: GigProject): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      onStore(await upsertProject(userId, { ...next, updatedAt: new Date().toISOString() }));
      return true;
    } catch (err) {
      setError(saveErrorText(err));
      return false;
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

  async function addInstallment() {
    const label = instLabel.trim();
    const amount = Math.round(Math.max(0, Number(instAmount) || 0) * 100) / 100;
    if (!label || amount <= 0) return;
    const inst: GigInstallment = {
      id: newGigId(),
      label,
      amount,
      dueOn: instDueOn.trim() || undefined,
      status: "pending",
      paidAmount: 0,
    };
    const ok = await persist({ ...project, installments: [...project.installments, inst] });
    if (ok) {
      setInstLabel("");
      setInstAmount("");
      setInstDueOn("");
    }
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
    const entry: GigTimeLog = {
      id: newGigId(),
      quantity,
      occurredOn: isoToday(),
      note: timeNote.trim() || undefined,
    };
    setTimeQty("");
    setTimeNote("");
    await persist({ ...project, timeLogs: [...(project.timeLogs ?? []), entry] });
  }

  async function removeTime(id: string) {
    const ok = await persist({
      ...project,
      timeLogs: (project.timeLogs ?? []).filter((entry) => entry.id !== id),
    });
    if (ok) setEditingTimeId((current) => (current === id ? null : current));
  }

  async function saveInstallment(next: GigInstallment) {
    const label = next.label.trim();
    const amount = Math.round(Math.max(0, Number(next.amount) || 0) * 100) / 100;
    if (!label || amount <= 0) return;
    let status = next.status;
    let paidAmount = Math.max(0, Number(next.paidAmount) || 0);
    if (status === "paid" || paidAmount >= amount) {
      status = "paid";
      paidAmount = amount;
    } else if (paidAmount > 0) {
      status = "partial";
    } else {
      status = "pending";
      paidAmount = 0;
    }
    const updated: GigInstallment = {
      ...next,
      label,
      amount,
      status,
      paidAmount,
      dueOn: next.dueOn?.trim() || undefined,
    };
    const ok = await persist({
      ...project,
      installments: project.installments.map((inst) => (inst.id === updated.id ? updated : inst)),
    });
    if (ok) setEditingInstallmentId(null);
  }

  async function removeInstallment(id: string) {
    if (!confirm(t("confirmDeleteInstallment"))) return;
    const ok = await persist({
      ...project,
      installments: project.installments.filter((inst) => inst.id !== id),
    });
    if (ok) setEditingInstallmentId((current) => (current === id ? null : current));
  }

  async function saveCostEdit(next: GigCost) {
    const name = next.name.trim();
    const amount = Math.round(Math.max(0, Number(next.amount) || 0) * 100) / 100;
    if (!name || amount <= 0) return;
    const ok = await persist({
      ...project,
      costs: project.costs.map((cost) => (cost.id === next.id ? { ...next, name, amount } : cost)),
    });
    if (ok) setEditingCostId(null);
  }

  async function removeCost(id: string) {
    if (!confirm(t("confirmDeleteCost"))) return;
    const ok = await persist({
      ...project,
      costs: project.costs.filter((cost) => cost.id !== id),
    });
    if (ok) setEditingCostId((current) => (current === id ? null : current));
  }

  async function saveTime(next: GigTimeLog) {
    const ok = await persist({
      ...project,
      timeLogs: (project.timeLogs ?? []).map((entry) => (entry.id === next.id ? next : entry)),
    });
    if (ok) setEditingTimeId(null);
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

  if (showingQuote) {
    return <GigQuoteSheet project={project} client={client} onClose={() => setShowingQuote(false)} />;
  }

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
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-full" disabled={busy} onClick={() => setShowingQuote(true)}>
            {t("quoteOpen")}
          </Button>
          <Button type="button" variant="outline" className="rounded-full" disabled={busy} onClick={() => setEditingProject(true)}>
            {t("editProject")}
          </Button>
        </div>
      </div>

      {editingProject ? (
        <GigProjectForm
          clients={clients}
          initial={project}
          saving={busy}
          onCancel={() => setEditingProject(false)}
          onSave={async (next) => {
            const ok = await persist(next);
            if (ok) setEditingProject(false);
          }}
        />
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-4">
        <SummaryCard label={t("contractTotal")} value={money(projectContractTotal(project))} />
        <SummaryCard label={t("received")} value={money(projectReceivedTotal(project))} tone="emerald" />
        <SummaryCard label={t("receivable")} value={money(projectReceivableTotal(project))} tone="amber" />
        <SummaryCard label={t("profit")} value={money(projectProfit(project))} />
      </div>
      <p className="text-xs text-muted-foreground">
        {t("costTotal")}: {money(projectCostTotal(project))}
        {timeQtyTotal > 0 ? ` · ${t("timeInvested", { qty: formatTimeQuantity(timeQtyTotal), unit: timeUnit })}` : ""}
      </p>

      <section className="space-y-3">
        <h3 className="text-base font-medium">{t("installments")}</h3>
        <p className="text-xs text-muted-foreground">{t("editKeepsLedger")}</p>
        <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-white/50 p-3">
          <div className="space-y-1">
            <Label htmlFor="gig-inst-label">{t("installmentLabel")}</Label>
            <Input id="gig-inst-label" value={instLabel} disabled={busy} onChange={(e) => setInstLabel(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gig-inst-amount">{t("amount")}</Label>
            <Input
              id="gig-inst-amount"
              type="number"
              min={0}
              step="0.01"
              value={instAmount}
              disabled={busy}
              onChange={(e) => setInstAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gig-inst-due">{t("dueOn")}</Label>
            <Input
              id="gig-inst-due"
              type="date"
              value={instDueOn}
              disabled={busy}
              onChange={(e) => setInstDueOn(e.target.value)}
            />
          </div>
          <Button type="button" className="rounded-full" disabled={busy} onClick={() => void addInstallment()}>
            {t("addInstallment")}
          </Button>
        </div>
        <ul className="space-y-2">
          {project.installments.map((inst) => {
            const left = installmentOutstanding(inst);
            if (editingInstallmentId === inst.id) {
              return (
                <li key={inst.id}>
                  <InstallmentEditor
                    installment={inst}
                    busy={busy}
                    onCancel={() => setEditingInstallmentId(null)}
                    onSave={(next) => void saveInstallment(next)}
                  />
                </li>
              );
            }
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
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={busy}
                    onClick={() => setEditingInstallmentId(inst.id)}
                  >
                    {t("edit")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={busy}
                    onClick={() => void removeInstallment(inst.id)}
                  >
                    {t("delete")}
                  </Button>
                </div>
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
              if (editingTimeId === entry.id) {
                return (
                  <li key={entry.id}>
                    <TimeLogEditor
                      entry={entry}
                      busy={busy}
                      onCancel={() => setEditingTimeId(null)}
                      onSave={(next) => void saveTime(next)}
                    />
                  </li>
                );
              }
              return (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white/70 px-4 py-3">
                  <div>
                    <p className="font-medium">
                      {formatTimeQuantity(entry.quantity)} {timeUnit}
                      {entry.note ? ` · ${entry.note}` : ""}
                    </p>
                    {entry.occurredOn ? <p className="text-xs text-muted-foreground">{entry.occurredOn}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      disabled={busy}
                      onClick={() => setEditingTimeId(entry.id)}
                    >
                      {t("editTime")}
                    </Button>
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
                  </div>
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
            project.costs.map((c) =>
              editingCostId === c.id ? (
                <li key={c.id}>
                  <CostEditor cost={c} busy={busy} onCancel={() => setEditingCostId(null)} onSave={(next) => void saveCostEdit(next)} />
                </li>
              ) : (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white/70 px-4 py-3">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {money(c.amount)}
                    {c.occurredOn ? ` · ${c.occurredOn}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {c.transactionId ? (
                    <span className="text-xs text-emerald-800">{t("onLedger")}</span>
                  ) : (
                    <Button type="button" size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => void logCost(c)}>
                      {t("logToLedger")}
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => setEditingCostId(c.id)}>
                    {t("edit")}
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => void removeCost(c.id)}>
                    {t("delete")}
                  </Button>
                </div>
              </li>
              ),
            )
          )}
        </ul>
      </section>
    </div>
  );
}

function TimeLogEditor({
  entry,
  busy,
  onCancel,
  onSave,
}: {
  entry: GigTimeLog;
  busy: boolean;
  onCancel: () => void;
  onSave: (next: GigTimeLog) => void;
}) {
  const t = useTranslations("gigs");
  const [qty, setQty] = useState(String(entry.quantity));
  const [note, setNote] = useState(entry.note ?? "");
  const [occurredOn, setOccurredOn] = useState(entry.occurredOn ?? isoToday());

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-white/70 p-3">
      <div className="space-y-1">
        <Label htmlFor={`time-qty-${entry.id}`}>{t("timeQuantity")}</Label>
        <Input
          id={`time-qty-${entry.id}`}
          type="number"
          min={0}
          step="0.01"
          value={qty}
          disabled={busy}
          onChange={(e) => setQty(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`time-date-${entry.id}`}>{t("timeDate")}</Label>
        <Input
          id={`time-date-${entry.id}`}
          type="date"
          value={occurredOn}
          disabled={busy}
          onChange={(e) => setOccurredOn(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`time-note-${entry.id}`}>{t("timeNote")}</Label>
        <Input id={`time-note-${entry.id}`} value={note} disabled={busy} onChange={(e) => setNote(e.target.value)} />
      </div>
      <Button
        type="button"
        size="sm"
        className="rounded-full"
        disabled={busy}
        onClick={() => {
          const quantity = Number(qty);
          if (!Number.isFinite(quantity) || quantity <= 0) return;
          onSave({
            ...entry,
            quantity,
            occurredOn: occurredOn.trim() || undefined,
            note: note.trim() || undefined,
          });
        }}
      >
        {t("save")}
      </Button>
      <Button type="button" size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={onCancel}>
        {t("cancel")}
      </Button>
    </div>
  );
}

function InstallmentEditor({
  installment,
  busy,
  onCancel,
  onSave,
}: {
  installment: GigInstallment;
  busy: boolean;
  onCancel: () => void;
  onSave: (next: GigInstallment) => void;
}) {
  const t = useTranslations("gigs");
  const [label, setLabel] = useState(installment.label);
  const [amount, setAmount] = useState(String(installment.amount));
  const [dueOn, setDueOn] = useState(installment.dueOn ?? "");

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-white/70 p-3">
      <div className="space-y-1">
        <Label htmlFor={`inst-label-${installment.id}`}>{t("installmentLabel")}</Label>
        <Input id={`inst-label-${installment.id}`} value={label} disabled={busy} onChange={(e) => setLabel(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`inst-amount-${installment.id}`}>{t("amount")}</Label>
        <Input
          id={`inst-amount-${installment.id}`}
          type="number"
          min={0}
          step="0.01"
          value={amount}
          disabled={busy}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`inst-due-${installment.id}`}>{t("dueOn")}</Label>
        <Input id={`inst-due-${installment.id}`} type="date" value={dueOn} disabled={busy} onChange={(e) => setDueOn(e.target.value)} />
      </div>
      <Button
        type="button"
        size="sm"
        className="rounded-full"
        disabled={busy}
        onClick={() => onSave({ ...installment, label, amount: Number(amount), dueOn: dueOn.trim() || undefined })}
      >
        {t("save")}
      </Button>
      <Button type="button" size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={onCancel}>
        {t("cancel")}
      </Button>
    </div>
  );
}

function CostEditor({
  cost,
  busy,
  onCancel,
  onSave,
}: {
  cost: GigCost;
  busy: boolean;
  onCancel: () => void;
  onSave: (next: GigCost) => void;
}) {
  const t = useTranslations("gigs");
  const [name, setName] = useState(cost.name);
  const [amount, setAmount] = useState(String(cost.amount));

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-white/70 p-3">
      <div className="space-y-1">
        <Label htmlFor={`cost-name-${cost.id}`}>{t("costName")}</Label>
        <Input id={`cost-name-${cost.id}`} value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`cost-amount-${cost.id}`}>{t("amount")}</Label>
        <Input
          id={`cost-amount-${cost.id}`}
          type="number"
          min={0}
          step="0.01"
          value={amount}
          disabled={busy}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <Button
        type="button"
        size="sm"
        className="rounded-full"
        disabled={busy}
        onClick={() => onSave({ ...cost, name, amount: Number(amount) })}
      >
        {t("save")}
      </Button>
      <Button type="button" size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={onCancel}>
        {t("cancel")}
      </Button>
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
