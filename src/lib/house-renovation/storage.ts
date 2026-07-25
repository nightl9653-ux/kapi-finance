import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { coerceCurrency } from "@/lib/fx";
import { defaultPhaseForType, isKnownPhase } from "@/lib/house-renovation/phases";
import type {
  MaterialCategory,
  ProjectPhase,
  RenovationMaterial,
  RenovationProject,
  RenovationProjectRow,
} from "@/lib/house-renovation/types";

const TABLE = "renovation_projects";

const CATEGORIES: MaterialCategory[] = ["structure", "finishes", "appliances", "furnishing", "labor", "misc"];

function throwIfError(error: { message?: string; code?: string } | null): asserts error is null {
  if (!error) return;
  const err = new Error(error.message || "Database error");
  (err as Error & { code?: string }).code = error.code;
  throw err;
}

function parseNumber(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeMaterial(raw: RenovationMaterial): RenovationMaterial {
  const category = CATEGORIES.includes(raw.category) ? raw.category : "misc";
  const transactionId = typeof raw.transactionId === "string" && raw.transactionId.trim() ? raw.transactionId.trim() : undefined;
  return {
    id: raw.id || newMaterialId(),
    name: String(raw.name ?? "").trim() || "—",
    quantity: Math.max(0, Number(raw.quantity) || 0),
    price: Math.max(0, Number(raw.price) || 0),
    category,
    phase: raw.phase,
    room: raw.room,
    supplyType: raw.supplyType,
    isPurchased: Boolean(raw.isPurchased) || Boolean(transactionId),
    note: raw.note?.trim() || undefined,
    transactionId,
  };
}

export function normalizeProject(row: RenovationProjectRow): RenovationProject {
  const projectType = row.project_type === "construction" ? "construction" : "renovation";
  const materials = Array.isArray(row.materials) ? row.materials.map(normalizeMaterial) : [];
  const currentPhase =
    row.current_phase && isKnownPhase(row.current_phase, projectType)
      ? (row.current_phase as ProjectPhase)
      : defaultPhaseForType(projectType);

  return {
    id: row.id,
    name: row.name,
    projectType,
    currency: coerceCurrency(row.currency),
    templateId: row.template_id ?? undefined,
    areaSqm: parseNumber(row.area_sqm),
    budgetCap: parseNumber(row.budget_cap),
    address: row.address?.trim() || undefined,
    startDate: row.start_date ?? undefined,
    targetEndDate: row.target_end_date ?? undefined,
    currentPhase,
    materials,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
  };
}

function projectToInsert(project: RenovationProject, userId: string) {
  return {
    user_id: userId,
    name: project.name,
    project_type: project.projectType,
    currency: coerceCurrency(project.currency),
    template_id: project.templateId ?? null,
    area_sqm: project.areaSqm ?? null,
    budget_cap: project.budgetCap ?? null,
    address: project.address ?? null,
    start_date: project.startDate ?? null,
    target_end_date: project.targetEndDate ?? null,
    current_phase: project.currentPhase ?? defaultPhaseForType(project.projectType),
    materials: project.materials,
    completed_at: project.completedAt ?? null,
    updated_at: new Date().toISOString(),
  };
}

function projectToUpdate(project: RenovationProject) {
  return {
    name: project.name,
    project_type: project.projectType,
    currency: coerceCurrency(project.currency),
    template_id: project.templateId ?? null,
    area_sqm: project.areaSqm ?? null,
    budget_cap: project.budgetCap ?? null,
    address: project.address ?? null,
    start_date: project.startDate ?? null,
    target_end_date: project.targetEndDate ?? null,
    current_phase: project.currentPhase ?? defaultPhaseForType(project.projectType),
    materials: project.materials,
    completed_at: project.completedAt ?? null,
    updated_at: new Date().toISOString(),
  };
}

export async function loadProjects(userId: string): Promise<RenovationProject[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throwIfError(error);
  return (data as RenovationProjectRow[]).map(normalizeProject);
}

export async function upsertProject(userId: string, project: RenovationProject): Promise<RenovationProject[]> {
  const supabase = createSupabaseBrowserClient();
  const isNew = project.id.startsWith("proj_");

  if (isNew) {
    const { error } = await supabase.from(TABLE).insert(projectToInsert(project, userId));
    throwIfError(error);
    return loadProjects(userId);
  }

  const { error } = await supabase.from(TABLE).update(projectToUpdate(project)).eq("id", project.id).eq("user_id", userId);
  throwIfError(error);
  return loadProjects(userId);
}

export async function deleteProject(userId: string, projectId: string): Promise<RenovationProject[]> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from(TABLE).delete().eq("id", projectId).eq("user_id", userId);
  throwIfError(error);
  return loadProjects(userId);
}

export function newProjectId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function newMaterialId(): string {
  return `mat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
