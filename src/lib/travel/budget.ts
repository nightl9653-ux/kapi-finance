import type { TravelItem, TravelItemCategory, TravelTrip } from "@/lib/travel/types";

export function itemLineTotal(item: TravelItem): number {
  const q = Number.isFinite(item.quantity) ? item.quantity : 0;
  const a = Number.isFinite(item.amount) ? item.amount : 0;
  return Math.round(q * a * 100) / 100;
}

export function isLogged(item: TravelItem): boolean {
  return Boolean(item.transactionId);
}

export type TripBudgetSummary = {
  plannedTotal: number;
  loggedTotal: number;
  pendingTotal: number;
  pendingCount: number;
  loggedCount: number;
  budgetCap?: number;
  remaining?: number;
  overCap: boolean;
  byCategory: Array<{ category: TravelItemCategory; planned: number; logged: number }>;
};

export function getTripBudgetSummary(trip: TravelTrip): TripBudgetSummary {
  let plannedTotal = 0;
  let loggedTotal = 0;
  let pendingTotal = 0;
  let pendingCount = 0;
  let loggedCount = 0;
  const catMap = new Map<TravelItemCategory, { planned: number; logged: number }>();

  for (const item of trip.items) {
    const line = itemLineTotal(item);
    plannedTotal += line;
    const bucket = catMap.get(item.category) ?? { planned: 0, logged: 0 };
    bucket.planned += line;
    if (isLogged(item)) {
      loggedTotal += line;
      loggedCount += 1;
      bucket.logged += line;
    } else {
      pendingTotal += line;
      pendingCount += 1;
    }
    catMap.set(item.category, bucket);
  }

  plannedTotal = round2(plannedTotal);
  loggedTotal = round2(loggedTotal);
  pendingTotal = round2(pendingTotal);

  const budgetCap = trip.budgetCap;
  const remaining =
    budgetCap != null && Number.isFinite(budgetCap) ? round2(budgetCap - plannedTotal) : undefined;
  const overCap = remaining != null && remaining < 0;

  return {
    plannedTotal,
    loggedTotal,
    pendingTotal,
    pendingCount,
    loggedCount,
    budgetCap,
    remaining,
    overCap,
    byCategory: [...catMap.entries()].map(([category, v]) => ({
      category,
      planned: round2(v.planned),
      logged: round2(v.logged),
    })),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
