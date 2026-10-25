import type { GigInstallment, GigProject, GigVertical } from "@/lib/gigs/types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 该期还差多少未收 */
export function installmentOutstanding(inst: GigInstallment): number {
  if (inst.status === "paid") return 0;
  const paid = Math.max(0, Number(inst.paidAmount) || 0);
  const amount = Math.max(0, Number(inst.amount) || 0);
  return round2(Math.max(0, amount - paid));
}

export function installmentReceived(inst: GigInstallment): number {
  if (inst.status === "paid") return round2(Math.max(0, Number(inst.amount) || 0));
  return round2(Math.max(0, Number(inst.paidAmount) || 0));
}

export function projectContractTotal(project: GigProject): number {
  return round2(project.installments.reduce((s, i) => s + (Number(i.amount) || 0), 0));
}

export function projectReceivedTotal(project: GigProject): number {
  return round2(project.installments.reduce((s, i) => s + installmentReceived(i), 0));
}

export function projectReceivableTotal(project: GigProject): number {
  return round2(project.installments.reduce((s, i) => s + installmentOutstanding(i), 0));
}

export function projectCostTotal(project: GigProject): number {
  return round2(project.costs.reduce((s, c) => s + (Number(c.amount) || 0), 0));
}

export function timeUnitForVertical(vertical: GigVertical): "hours" | "sessions" {
  return vertical === "training" ? "sessions" : "hours";
}

export function projectTimeQuantity(project: GigProject): number {
  return round2((project.timeLogs ?? []).reduce((s, entry) => s + (Number(entry.quantity) || 0), 0));
}

export function formatTimeQuantity(quantity: number): string {
  const rounded = round2(quantity);
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/** 已收 − 项目成本。工时不参与利润。 */
export function projectProfit(project: GigProject): number {
  return round2(projectReceivedTotal(project) - projectCostTotal(project));
}

export type ProfitRankRow = {
  project: GigProject;
  profit: number;
  rank: number;
};

export type ProfitBoard = {
  currency: string;
  rows: ProfitRankRow[];
};

/** 未取消项目按利润从高到低。每种币种一张榜，不跨币种比较。 */
export function profitLeaderboards(projects: GigProject[]): ProfitBoard[] {
  const groups = new Map<string, GigProject[]>();
  for (const project of projects) {
    if (project.status === "cancelled") continue;
    const list = groups.get(project.currency) ?? [];
    list.push(project);
    groups.set(project.currency, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, list]) => {
      const sorted = [...list].sort((a, b) => {
        const byProfit = projectProfit(b) - projectProfit(a);
        if (byProfit !== 0) return byProfit;
        return a.name.localeCompare(b.name);
      });
      return {
        currency,
        rows: sorted.map((project, index) => ({
          project,
          profit: projectProfit(project),
          rank: index + 1,
        })),
      };
    });
}

/** 折合时薪 = 利润 ÷ 小时。不改利润。私教按节记，不算；没记小时则没有这个数。 */
export function projectHourlyProfit(project: GigProject): number | null {
  if (timeUnitForVertical(project.vertical) !== "hours") return null;
  const hours = projectTimeQuantity(project);
  if (!(hours > 0)) return null;
  return round2(projectProfit(project) / hours);
}

/** 约定节数。空、0 或非数字视为没约定。 */
export function parseSessionQuota(raw: unknown): number | undefined {
  if (typeof raw === "string" && !raw.trim()) return undefined;
  if (raw == null) return undefined;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return round2(n);
}

/** 这一节赚多少 = 利润 ÷ 已上节数。不改利润。没记课时则没有这个数。 */
export function projectSessionProfit(project: GigProject): number | null {
  if (timeUnitForVertical(project.vertical) !== "sessions") return null;
  const sessions = projectTimeQuantity(project);
  if (!(sessions > 0)) return null;
  return round2(projectProfit(project) / sessions);
}

/** 还剩几节 = 约定节数 − 已上节数。没约定则没有这个数。上超了可以为负。 */
export function projectSessionsRemaining(project: GigProject): number | null {
  if (timeUnitForVertical(project.vertical) !== "sessions") return null;
  const quota = parseSessionQuota(project.sessionQuota);
  if (quota == null) return null;
  return round2(quota - projectTimeQuantity(project));
}

export type UnpaidRow = {
  projectId: string;
  projectName: string;
  clientId: string;
  installmentId: string;
  label: string;
  outstanding: number;
  currency: string;
  dueOn?: string;
  status: GigInstallment["status"];
  lastNudgedOn?: string;
  nextNudgeOn?: string;
};

export function isIsoDate(value: string | undefined | null): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function addIsoDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 改这一期的到期日。空字符串会清掉。分期不存在或日期没变时返回 null。 */
export function setInstallmentDueOn(
  project: GigProject,
  installmentId: string,
  dueOn: string | undefined,
): GigProject | null {
  const current = project.installments.find((inst) => inst.id === installmentId);
  if (!current) return null;
  const nextDue = isIsoDate(dueOn) ? dueOn : undefined;
  if ((current.dueOn || undefined) === nextDue) return null;
  return {
    ...project,
    installments: project.installments.map((inst) =>
      inst.id === installmentId ? { ...inst, dueOn: nextDue } : inst,
    ),
  };
}

/** 下次再催日期已到（含今天） */
export function isChaseDue(nextNudgeOn: string | undefined, today: string): boolean {
  return Boolean(nextNudgeOn && nextNudgeOn <= today);
}

/** 把这一期标成已收清。传入 transactionId 时挂上总账流水。尚欠为 0 时不改。 */
export function markInstallmentPaid(
  project: GigProject,
  installmentId: string,
  paidOn: string,
  transactionId?: string,
): GigProject | null {
  const current = project.installments.find((inst) => inst.id === installmentId);
  if (!current || installmentOutstanding(current) <= 0) return null;
  return {
    ...project,
    installments: project.installments.map((inst) =>
      inst.id === installmentId
        ? {
            ...inst,
            status: "paid",
            paidAmount: inst.amount,
            paidOn,
            transactionId: transactionId ?? inst.transactionId,
          }
        : inst,
    ),
  };
}

export function nudgeInstallment(
  project: GigProject,
  installmentId: string,
  nextOn: string,
  today: string,
): GigProject {
  const nextNudgeOn = isIsoDate(nextOn) ? nextOn : addIsoDays(today, 7);
  return {
    ...project,
    installments: project.installments.map((inst) =>
      inst.id === installmentId ? { ...inst, lastNudgedOn: today, nextNudgeOn } : inst,
    ),
  };
}

export function collectUnpaid(projects: GigProject[]): UnpaidRow[] {
  const rows: UnpaidRow[] = [];
  for (const p of projects) {
    if (p.status === "cancelled") continue;
    for (const inst of p.installments) {
      const outstanding = installmentOutstanding(inst);
      if (outstanding <= 0) continue;
      rows.push({
        projectId: p.id,
        projectName: p.name,
        clientId: p.clientId,
        installmentId: inst.id,
        label: inst.label,
        outstanding,
        currency: p.currency,
        dueOn: inst.dueOn,
        status: inst.status,
        lastNudgedOn: inst.lastNudgedOn,
        nextNudgeOn: inst.nextNudgeOn,
      });
    }
  }
  rows.sort((a, b) => {
    const ad = a.dueOn || "9999-99-99";
    const bd = b.dueOn || "9999-99-99";
    if (ad !== bd) return ad < bd ? -1 : 1;
    return b.outstanding - a.outstanding;
  });
  return rows;
}

export type AgingBucket = "notDue" | "d0_30" | "d31_60" | "d60plus" | "noDue";

export function agingBucket(dueOn: string | undefined, today: string): AgingBucket {
  if (!dueOn) return "noDue";
  if (dueOn >= today) return "notDue";
  const due = new Date(`${dueOn}T12:00:00`);
  const now = new Date(`${today}T12:00:00`);
  const days = Math.floor((now.getTime() - due.getTime()) / 86400000);
  if (days <= 30) return "d0_30";
  if (days <= 60) return "d31_60";
  return "d60plus";
}

export type ClientCurrencyTotals = {
  currency: string;
  received: number;
  receivable: number;
};

/** 该客户名下未取消项目的累计已收与还欠，按项目币种分开 */
export function clientCurrencyTotals(projects: GigProject[], clientId: string): ClientCurrencyTotals[] {
  const map = new Map<string, { received: number; receivable: number }>();
  for (const project of projects) {
    if (project.clientId !== clientId || project.status === "cancelled") continue;
    const prev = map.get(project.currency) ?? { received: 0, receivable: 0 };
    prev.received = round2(prev.received + projectReceivedTotal(project));
    prev.receivable = round2(prev.receivable + projectReceivableTotal(project));
    map.set(project.currency, prev);
  }
  return [...map.entries()].map(([currency, totals]) => ({ currency, ...totals }));
}

export function sumUnpaidByCurrency(rows: UnpaidRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.currency, round2((map.get(r.currency) ?? 0) + r.outstanding));
  }
  return map;
}
