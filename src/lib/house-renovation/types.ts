import type { Currency } from "@/lib/fx";

export type ProjectType = "renovation" | "construction";

export type RenovationPhase =
  | "demolition"
  | "plumbingElectrical"
  | "carpentryMasonry"
  | "painting"
  | "installation"
  | "furnishing"
  | "inspection";

export type ConstructionPhase =
  | "foundation"
  | "structure"
  | "roofing"
  | "exterior"
  | "interiorRough"
  | "interiorFinish"
  | "landscaping"
  | "inspection";

export type ProjectPhase = RenovationPhase | ConstructionPhase;

export type MaterialCategory = "structure" | "finishes" | "appliances" | "furnishing" | "labor" | "misc";

export type RenovationRoom = "whole" | "living" | "kitchen" | "bathroom" | "bedroom" | "balcony" | "exterior";

export type SupplyType = "selfPurchase" | "turnkey" | "laborOnly";

export type ProjectDetailTab = "overview" | "materials";

export type MaterialsSubTab = "all" | "purchased" | "shopping";

export interface RenovationMaterial {
  id: string;
  name: string;
  quantity: number;
  price: number;
  category: MaterialCategory;
  phase: ProjectPhase;
  room?: RenovationRoom;
  supplyType?: SupplyType;
  isPurchased: boolean;
  note?: string;
  /** 已同步到总账的交易 id */
  transactionId?: string;
}

export interface RenovationProject {
  id: string;
  name: string;
  projectType: ProjectType;
  /** Working currency for list amounts (ledger converts to USD base). */
  currency: Currency;
  templateId?: string;
  areaSqm?: number;
  budgetCap?: number;
  address?: string;
  startDate?: string;
  targetEndDate?: string;
  currentPhase?: ProjectPhase;
  materials: RenovationMaterial[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface RenovationProjectRow {
  id: string;
  user_id: string;
  name: string;
  project_type: ProjectType;
  currency: string | null;
  template_id: string | null;
  area_sqm: number | null;
  budget_cap: number | null;
  address: string | null;
  start_date: string | null;
  target_end_date: string | null;
  current_phase: string | null;
  materials: RenovationMaterial[];
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
