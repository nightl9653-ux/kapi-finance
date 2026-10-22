import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { coerceCurrency } from "@/lib/fx";
import {
  GIG_INSTALLMENT_STATUSES,
  GIG_PROJECT_STATUSES,
  GIG_VERTICALS,
  newGigId,
  type GigClient,
  type GigClientRow,
  type GigCost,
  type GigInstallment,
  type GigInstallmentStatus,
  type GigProject,
  type GigProjectRow,
  type GigProjectStatus,
  type GigTimeLog,
  type GigVertical,
  type GigsStore,
} from "@/lib/gigs/types";

const CLIENTS_TABLE = "studio_clients";
const PROJECTS_TABLE = "studio_projects";

export function gigsErrorCode(err: unknown): "time_schema" | "schema" | "other" {
  const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined;
  const msg = err instanceof Error ? err.message : "";
  if (/time_logs/i.test(msg)) return "time_schema";
  if (
    code === "42P01" ||
    code === "PGRST205" ||
    /studio_clients|studio_projects|schema cache|does not exist/i.test(msg)
  ) {
    return "schema";
  }
  return "other";
}

function throwIfError(error: { message?: string; code?: string } | null): asserts error is null {
  if (!error) return;
  const err = new Error(error.message || "Database error");
  (err as Error & { code?: string }).code = error.code;
  throw err;
}

function asVertical(raw: string): GigVertical {
  return (GIG_VERTICALS as readonly string[]).includes(raw) ? (raw as GigVertical) : "other";
}

function asProjectStatus(raw: string): GigProjectStatus {
  return (GIG_PROJECT_STATUSES as readonly string[]).includes(raw)
    ? (raw as GigProjectStatus)
    : "active";
}

function isoDateOrUndef(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function asInstallmentStatus(raw: string): GigInstallmentStatus {
  return (GIG_INSTALLMENT_STATUSES as readonly string[]).includes(raw)
    ? (raw as GigInstallmentStatus)
    : "pending";
}

function normalizeInstallment(raw: Partial<GigInstallment>): GigInstallment {
  const amount = Math.max(0, Number(raw.amount) || 0);
  const status = asInstallmentStatus(String(raw.status ?? "pending"));
  let paidAmount = Math.max(0, Number(raw.paidAmount) || 0);
  if (status === "paid") paidAmount = amount;
  if (status === "pending") paidAmount = Math.min(paidAmount, amount);
  return {
    id: raw.id || newGigId(),
    label: String(raw.label ?? "").trim() || "—",
    amount,
    dueOn: raw.dueOn?.trim() || undefined,
    status,
    paidAmount,
    paidOn: raw.paidOn?.trim() || undefined,
    lastNudgedOn: isoDateOrUndef(raw.lastNudgedOn),
    nextNudgeOn: isoDateOrUndef(raw.nextNudgeOn),
    transactionId:
      typeof raw.transactionId === "string" && raw.transactionId.trim()
        ? raw.transactionId.trim()
        : undefined,
  };
}

function normalizeTimeLog(raw: Partial<GigTimeLog>): GigTimeLog | null {
  const quantity = Math.round((Number(raw.quantity) || 0) * 100) / 100;
  if (quantity <= 0) return null;
  return {
    id: raw.id || newGigId(),
    quantity,
    occurredOn: isoDateOrUndef(raw.occurredOn),
    note: raw.note?.trim() || undefined,
  };
}

function normalizeCost(raw: Partial<GigCost>): GigCost {
  return {
    id: raw.id || newGigId(),
    name: String(raw.name ?? "").trim() || "—",
    amount: Math.max(0, Number(raw.amount) || 0),
    occurredOn: raw.occurredOn?.trim() || undefined,
    note: raw.note?.trim() || undefined,
    transactionId:
      typeof raw.transactionId === "string" && raw.transactionId.trim()
        ? raw.transactionId.trim()
        : undefined,
  };
}

export function clientFromRow(row: GigClientRow): GigClient {
  return {
    id: row.id,
    name: row.name,
    company: row.company?.trim() || undefined,
    phone: row.phone?.trim() || undefined,
    email: row.email?.trim() || undefined,
    notes: row.notes?.trim() || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function projectFromRow(row: GigProjectRow): GigProject {
  const installments = Array.isArray(row.installments)
    ? row.installments.map((i) => normalizeInstallment(i))
    : [];
  const costs = Array.isArray(row.costs) ? row.costs.map((c) => normalizeCost(c)) : [];
  const timeLogs = Array.isArray(row.time_logs)
    ? row.time_logs.map((entry) => normalizeTimeLog(entry)).filter((entry): entry is GigTimeLog => entry !== null)
    : [];
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    vertical: asVertical(row.vertical),
    currency: coerceCurrency(row.currency),
    status: asProjectStatus(row.status),
    notes: row.notes?.trim() || undefined,
    installments,
    costs,
    timeLogs,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadGigsStore(userId: string): Promise<GigsStore> {
  const supabase = createSupabaseBrowserClient();
  const [clientsRes, projectsRes] = await Promise.all([
    supabase.from(CLIENTS_TABLE).select("*").eq("user_id", userId).order("updated_at", { ascending: false }),
    supabase.from(PROJECTS_TABLE).select("*").eq("user_id", userId).order("updated_at", { ascending: false }),
  ]);
  throwIfError(clientsRes.error);
  throwIfError(projectsRes.error);
  return {
    clients: ((clientsRes.data as GigClientRow[]) ?? []).map(clientFromRow),
    projects: ((projectsRes.data as GigProjectRow[]) ?? []).map(projectFromRow),
  };
}

export async function upsertClient(userId: string, client: GigClient): Promise<GigsStore> {
  const supabase = createSupabaseBrowserClient();
  const id = client.id || newGigId();
  const payload = {
    name: client.name.trim(),
    company: client.company?.trim() || null,
    phone: client.phone?.trim() || null,
    email: client.email?.trim() || null,
    notes: client.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { data: found } = await supabase
    .from(CLIENTS_TABLE)
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (found) {
    const { error } = await supabase.from(CLIENTS_TABLE).update(payload).eq("id", id).eq("user_id", userId);
    throwIfError(error);
  } else {
    const { error } = await supabase.from(CLIENTS_TABLE).insert({
      id,
      user_id: userId,
      ...payload,
    });
    throwIfError(error);
  }
  return loadGigsStore(userId);
}

export async function deleteClient(userId: string, clientId: string): Promise<GigsStore> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from(CLIENTS_TABLE).delete().eq("id", clientId).eq("user_id", userId);
  throwIfError(error);
  return loadGigsStore(userId);
}

export async function upsertProject(userId: string, project: GigProject): Promise<GigsStore> {
  const supabase = createSupabaseBrowserClient();
  const id = project.id || newGigId();
  const payload = {
    client_id: project.clientId,
    name: project.name.trim(),
    vertical: project.vertical,
    currency: coerceCurrency(project.currency),
    status: project.status,
    notes: project.notes?.trim() || null,
    installments: project.installments.map((i) => normalizeInstallment(i)),
    costs: project.costs.map((c) => normalizeCost(c)),
    time_logs: (project.timeLogs ?? [])
      .map((entry) => normalizeTimeLog(entry))
      .filter((entry): entry is GigTimeLog => entry !== null),
    updated_at: new Date().toISOString(),
  };

  const { data: found } = await supabase
    .from(PROJECTS_TABLE)
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (found) {
    const { error } = await supabase.from(PROJECTS_TABLE).update(payload).eq("id", id).eq("user_id", userId);
    throwIfError(error);
  } else {
    const { error } = await supabase.from(PROJECTS_TABLE).insert({
      id,
      user_id: userId,
      ...payload,
    });
    throwIfError(error);
  }
  return loadGigsStore(userId);
}

export async function deleteProject(userId: string, projectId: string): Promise<GigsStore> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from(PROJECTS_TABLE).delete().eq("id", projectId).eq("user_id", userId);
  throwIfError(error);
  return loadGigsStore(userId);
}
