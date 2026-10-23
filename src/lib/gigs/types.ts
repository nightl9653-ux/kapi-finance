import type { Currency } from "@/lib/fx";

export const GIG_VERTICALS = ["design", "development", "training", "consulting", "other"] as const;
export type GigVertical = (typeof GIG_VERTICALS)[number];

export const GIG_PROJECT_STATUSES = ["quote", "active", "done", "cancelled"] as const;
export type GigProjectStatus = (typeof GIG_PROJECT_STATUSES)[number];

export const GIG_INSTALLMENT_STATUSES = ["pending", "partial", "paid"] as const;
export type GigInstallmentStatus = (typeof GIG_INSTALLMENT_STATUSES)[number];

export type GigClient = {
  id: string;
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type GigInstallment = {
  id: string;
  label: string;
  amount: number;
  dueOn?: string;
  status: GigInstallmentStatus;
  /** 已收金额（partial 时用；paid 时默认 = amount） */
  paidAmount: number;
  paidOn?: string;
  transactionId?: string;
  /** 最近一次点「已催」的日期 */
  lastNudgedOn?: string;
  /** 下次再催；到了这一天会出现在「今天该催」 */
  nextNudgeOn?: string;
};

export type GigCost = {
  id: string;
  name: string;
  amount: number;
  occurredOn?: string;
  note?: string;
  transactionId?: string;
};

/** 开发/设计/顾问记小时；私教记节。只记自己的投入，不计入利润。 */
export type GigTimeLog = {
  id: string;
  quantity: number;
  occurredOn?: string;
  note?: string;
};

export type GigProject = {
  id: string;
  clientId: string;
  name: string;
  vertical: GigVertical;
  currency: Currency;
  status: GigProjectStatus;
  notes?: string;
  installments: GigInstallment[];
  costs: GigCost[];
  timeLogs: GigTimeLog[];
  /** 私教约定节数。空则不算还剩几节。 */
  sessionQuota?: number;
  createdAt: string;
  updatedAt: string;
};

export type GigClientRow = {
  id: string;
  user_id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type GigProjectRow = {
  id: string;
  user_id: string;
  client_id: string;
  name: string;
  vertical: string;
  currency: string | null;
  status: string;
  notes: string | null;
  installments: GigInstallment[];
  costs: GigCost[];
  time_logs?: GigTimeLog[];
  session_quota?: number | string | null;
  created_at: string;
  updated_at: string;
};

export type GigsStore = {
  clients: GigClient[];
  projects: GigProject[];
};

export function newGigId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function isoToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
