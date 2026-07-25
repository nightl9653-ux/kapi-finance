import type { Material, MaterialCategory, Party } from "@/lib/banquet-party/types";

export interface CategoryBudget {
  category: MaterialCategory;
  planned: number;
  purchased: number;
  itemCount: number;
  pendingCount: number;
}

export interface PartyBudgetSummary {
  totalPlanned: number;
  totalPurchased: number;
  totalPending: number;
  budgetCap?: number;
  overCap: boolean;
  remaining?: number;
  byCategory: CategoryBudget[];
  decorSetupDone: number;
  decorSetupTotal: number;
}

const CATEGORIES: MaterialCategory[] = ["drink", "food", "decor", "misc"];

export function getPartyBudgetSummary(party: Party): PartyBudgetSummary {
  const byCategory = CATEGORIES.map((category) => {
    const items = party.materials.filter((m) => m.category === category);
    const planned = items.reduce((s, m) => s + m.quantity * m.price, 0);
    const purchased = items.filter((m) => m.isPurchased).reduce((s, m) => s + m.quantity * m.price, 0);
    return {
      category,
      planned,
      purchased,
      itemCount: items.length,
      pendingCount: items.filter((m) => !m.isPurchased).length,
    };
  });

  const decorItems = party.materials.filter((m) => m.category === "decor");
  const totalPlanned = byCategory.reduce((s, c) => s + c.planned, 0);
  const totalPurchased = byCategory.reduce((s, c) => s + c.purchased, 0);
  const budgetCap = party.budgetCap != null && party.budgetCap > 0 ? party.budgetCap : undefined;
  const overCap = budgetCap != null && totalPlanned > budgetCap;
  return {
    totalPlanned,
    totalPurchased,
    totalPending: party.materials.filter((m) => !m.isPurchased).length,
    budgetCap,
    overCap,
    remaining: budgetCap != null ? budgetCap - totalPlanned : undefined,
    byCategory,
    decorSetupDone: decorItems.filter((m) => m.isSetup).length,
    decorSetupTotal: decorItems.length,
  };
}

export function getGuestHeadcount(party: Party): { confirmed: number; total: number } {
  const guests = party.guests ?? [];
  const confirmed = guests.filter((g) => g.rsvp === "confirmed").reduce((s, g) => s + g.count, 0);
  const total = guests.reduce((s, g) => s + g.count, 0);
  return { confirmed, total };
}

export function daysUntilParty(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date + "T00:00:00");
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function filterMaterialsForPrep(
  materials: Material[],
  sub: "shopping" | "menu" | "decor" | "misc",
): Material[] {
  if (sub === "menu") return materials.filter((m) => m.category === "food" || m.category === "drink");
  if (sub === "decor") return materials.filter((m) => m.category === "decor");
  if (sub === "misc") return materials.filter((m) => m.category === "misc");
  return materials;
}
