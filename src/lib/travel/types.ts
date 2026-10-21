import type { Currency } from "@/lib/fx";

export const TRAVEL_ITEM_CATEGORIES = [
  "transport",
  "lodging",
  "food",
  "tickets",
  "shopping",
  "other",
] as const;

export type TravelItemCategory = (typeof TRAVEL_ITEM_CATEGORIES)[number];

export type TravelItem = {
  id: string;
  name: string;
  category: TravelItemCategory;
  /** 计划单价（项目币种） */
  amount: number;
  quantity: number;
  note?: string;
  /** 已写入总账 */
  transactionId?: string;
};

export type TravelTrip = {
  id: string;
  name: string;
  destination?: string;
  currency: Currency;
  budgetCap?: number;
  startDate?: string;
  endDate?: string;
  notes?: string;
  items: TravelItem[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

export type TravelTripRow = {
  id: string;
  user_id: string;
  name: string;
  destination: string | null;
  currency: string | null;
  budget_cap: number | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  items: TravelItem[];
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export function newTravelId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
