import type { MaterialCategory, ProjectPhase, RenovationProject } from "@/lib/house-renovation/types";
import { phasesForProjectType } from "@/lib/house-renovation/phases";

export interface CategoryBudget {
  category: MaterialCategory;
  planned: number;
  purchased: number;
  itemCount: number;
  pendingCount: number;
}

export interface PhaseBudget {
  phase: ProjectPhase;
  planned: number;
  purchased: number;
  itemCount: number;
  loggedCount: number;
  /** 0–1, based on logged (记入记账) items */
  progress: number;
}

export interface ProjectBudgetSummary {
  totalPlanned: number;
  totalPurchased: number;
  totalPending: number;
  /** 清单已入账金额（有 transactionId） */
  totalLogged: number;
  budgetCap?: number;
  overCap: boolean;
  /** 计划合计超过上限 */
  overCapPlanned: boolean;
  costPerSqm?: number;
  byCategory: CategoryBudget[];
  byPhase: PhaseBudget[];
}

export type ScheduleStatus =
  | { kind: "none" }
  | { kind: "daysLeft"; days: number }
  | { kind: "dueToday" }
  | { kind: "overdue"; days: number };

const CATEGORIES: MaterialCategory[] = ["structure", "finishes", "appliances", "furnishing", "labor", "misc"];

export function lineTotal(quantity: number, price: number): number {
  return quantity * price;
}

function isLogged(m: RenovationProject["materials"][number]) {
  return Boolean(m.transactionId);
}

function summarizeItems(items: RenovationProject["materials"]) {
  const planned = items.reduce((s, m) => s + lineTotal(m.quantity, m.price), 0);
  const purchased = items
    .filter((m) => isLogged(m) || m.isPurchased)
    .reduce((s, m) => s + lineTotal(m.quantity, m.price), 0);
  const loggedCount = items.filter(isLogged).length;
  return {
    planned,
    purchased,
    itemCount: items.length,
    pendingCount: items.filter((m) => !isLogged(m) && !m.isPurchased).length,
    loggedCount,
    progress: items.length > 0 ? loggedCount / items.length : 0,
  };
}

export function getProjectBudgetSummary(project: RenovationProject): ProjectBudgetSummary {
  const byCategory = CATEGORIES.map((category) => {
    const items = project.materials.filter((m) => m.category === category);
    const s = summarizeItems(items);
    return {
      category,
      planned: s.planned,
      purchased: s.purchased,
      itemCount: s.itemCount,
      pendingCount: s.pendingCount,
    };
  });

  const phaseOrder = phasesForProjectType(project.projectType);
  const phasesWithItems = new Set(project.materials.map((m) => m.phase));
  const orderedPhases = [
    ...phaseOrder.filter((p) => phasesWithItems.has(p)),
    ...[...phasesWithItems].filter((p) => !phaseOrder.includes(p)),
  ];

  const byPhase: PhaseBudget[] = orderedPhases.map((phase) => {
    const items = project.materials.filter((m) => m.phase === phase);
    const s = summarizeItems(items);
    return {
      phase,
      planned: s.planned,
      purchased: s.purchased,
      itemCount: s.itemCount,
      loggedCount: s.loggedCount,
      progress: s.progress,
    };
  });

  const totalPlanned = byCategory.reduce((s, c) => s + c.planned, 0);
  const totalPurchased = byCategory.reduce((s, c) => s + c.purchased, 0);
  const totalLogged = project.materials
    .filter(isLogged)
    .reduce((s, m) => s + lineTotal(m.quantity, m.price), 0);
  const budgetCap = project.budgetCap != null && project.budgetCap > 0 ? project.budgetCap : undefined;
  const overCapPlanned = budgetCap != null && totalPlanned > budgetCap;
  const costPerSqm =
    project.areaSqm && project.areaSqm > 0 ? totalPlanned / project.areaSqm : undefined;

  return {
    totalPlanned,
    totalPurchased,
    totalPending: project.materials.filter((m) => !isLogged(m) && !m.isPurchased).length,
    totalLogged,
    budgetCap,
    overCap: overCapPlanned,
    overCapPlanned,
    costPerSqm,
    byCategory: byCategory.filter((c) => c.itemCount > 0),
    byPhase,
  };
}

/** 相对预算上限的占用比例（可 >1） */
export function capRatio(amount: number, budgetCap: number | undefined): number | null {
  if (budgetCap == null || budgetCap <= 0) return null;
  return amount / budgetCap;
}

export function getScheduleStatus(targetEndDate: string | undefined, today = new Date()): ScheduleStatus {
  if (!targetEndDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetEndDate)) return { kind: "none" };
  const end = new Date(`${targetEndDate}T00:00:00`);
  if (!Number.isFinite(end.getTime())) return { kind: "none" };
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);
  const diffDays = Math.round((end.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 0) return { kind: "daysLeft", days: diffDays };
  if (diffDays === 0) return { kind: "dueToday" };
  return { kind: "overdue", days: Math.abs(diffDays) };
}

/** 全阶段条：含尚无材料的阶段，便于看当前进度位置 */
export function getPhaseTimeline(project: RenovationProject): {
  phase: ProjectPhase;
  isCurrent: boolean;
  itemCount: number;
  loggedCount: number;
  progress: number;
  planned: number;
  purchased: number;
}[] {
  const current = project.currentPhase ?? phasesForProjectType(project.projectType)[0];
  return phasesForProjectType(project.projectType).map((phase) => {
    const items = project.materials.filter((m) => m.phase === phase);
    const s = summarizeItems(items);
    return {
      phase,
      isCurrent: phase === current,
      itemCount: s.itemCount,
      loggedCount: s.loggedCount,
      progress: s.progress,
      planned: s.planned,
      purchased: s.purchased,
    };
  });
}
