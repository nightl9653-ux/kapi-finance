import { newTravelId, type TravelItem, type TravelItemCategory } from "@/lib/travel/types";

export type TravelTemplateId = "weekend" | "family" | "business";

type Seed = { name: string; category: TravelItemCategory; amount: number; quantity?: number };

const SEEDS: Record<TravelTemplateId, Seed[]> = {
  weekend: [
    { name: "往返交通", category: "transport", amount: 800 },
    { name: "两晚住宿", category: "lodging", amount: 600, quantity: 2 },
    { name: "餐饮预算", category: "food", amount: 400 },
    { name: "景点门票", category: "tickets", amount: 200 },
  ],
  family: [
    { name: "全家机票/车票", category: "transport", amount: 3000 },
    { name: "酒店（多晚）", category: "lodging", amount: 800, quantity: 4 },
    { name: "餐饮", category: "food", amount: 1200 },
    { name: "乐园/展览门票", category: "tickets", amount: 900 },
    { name: "纪念品", category: "shopping", amount: 300 },
  ],
  business: [
    { name: "差旅交通", category: "transport", amount: 1500 },
    { name: "商务酒店", category: "lodging", amount: 700, quantity: 3 },
    { name: "工作餐", category: "food", amount: 500 },
    { name: "其他杂费", category: "other", amount: 200 },
  ],
};

export function itemsFromTemplate(templateId: TravelTemplateId): TravelItem[] {
  return (SEEDS[templateId] ?? []).map((s) => ({
    id: newTravelId(),
    name: s.name,
    category: s.category,
    amount: s.amount,
    quantity: s.quantity ?? 1,
  }));
}
