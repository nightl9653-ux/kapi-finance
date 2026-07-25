"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { MaterialFormDialog } from "@/components/house-renovation/MaterialFormDialog";
import { ProjectForm } from "@/components/house-renovation/ProjectForm";
import { ProjectMaterialsTab } from "@/components/house-renovation/project-detail/ProjectMaterialsTab";
import { ProjectOverviewTab } from "@/components/house-renovation/project-detail/ProjectOverviewTab";
import { ProjectTabBar } from "@/components/house-renovation/project-detail/ProjectTabBar";
import { ListExportButtons } from "@/components/shared/ListExportButtons";
import { Button } from "@/components/ui/button";
import { getProjectBudgetSummary } from "@/lib/house-renovation/budget";
import { exportProjectCsv, exportProjectPdf } from "@/lib/house-renovation/export-list";
import { logRenovationMaterialExpense } from "@/lib/house-renovation/log-expense";
import { newMaterialId, upsertProject } from "@/lib/house-renovation/storage";
import type { ProjectDetailTab, RenovationMaterial, RenovationProject } from "@/lib/house-renovation/types";
import { BASE_CURRENCY, coerceCurrency, formatProjectMoney } from "@/lib/fx";

export function ProjectDetailClient({
  project: initial,
  userId,
  onBack,
  onProjectUpdated,
}: {
  project: RenovationProject;
  userId: string;
  onBack: () => void;
  onProjectUpdated?: (projects: RenovationProject[]) => void;
}) {
  const t = useTranslations("houseRenovation");
  const locale = useLocale();
  const [project, setProject] = useState(initial);
  const [tab, setTab] = useState<ProjectDetailTab>("overview");
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggingMaterialId, setLoggingMaterialId] = useState<string | null>(null);

  const budget = useMemo(() => getProjectBudgetSummary(project), [project]);
  const currency = coerceCurrency(project.currency ?? BASE_CURRENCY);

  const persist = async (next: RenovationProject) => {
    const prev = project;
    setProject(next);
    setSaving(true);
    setError(null);
    try {
      const updated = await upsertProject(userId, next);
      const saved = updated.find((p) => p.id === next.id) ?? next;
      setProject(saved);
      onProjectUpdated?.(updated);
    } catch (e) {
      setProject(prev);
      const code = e instanceof Error ? (e as Error & { code?: string }).code : undefined;
      const msg = e instanceof Error ? e.message : "";
      setError(
        code === "PGRST204" && msg.includes("currency") ? t("currencyMigrationError") : t("saveError"),
      );
    } finally {
      setSaving(false);
    }
  };

  const addMaterial = (mat: Omit<RenovationMaterial, "id">) => {
    void persist({ ...project, materials: [...project.materials, { ...mat, id: newMaterialId() }] });
  };

  const updateMaterial = (id: string, mat: Omit<RenovationMaterial, "id">) => {
    void persist({
      ...project,
      materials: project.materials.map((m) =>
        m.id === id
          ? {
              ...mat,
              id,
              transactionId: m.transactionId,
              isPurchased: mat.isPurchased ?? m.isPurchased,
            }
          : m,
      ),
    });
  };

  const deleteMaterial = (id: string) => {
    if (!confirm(t("deleteMaterialConfirm"))) return;
    void persist({ ...project, materials: project.materials.filter((m) => m.id !== id) });
  };

  const completeProject = () => {
    void persist({ ...project, completedAt: new Date().toISOString() });
  };

  const logExpense = async (materialId: string) => {
    const m = project.materials.find((x) => x.id === materialId);
    if (!m || m.transactionId || loggingMaterialId) return;
    const amount = m.quantity * m.price;
    if (amount <= 0) {
      const msg = t("logExpenseInvalidAmount");
      setError(msg);
      alert(msg);
      return;
    }
    if (!confirm(t("logExpenseConfirm", { name: m.name, amount: formatProjectMoney(amount, currency) }))) return;

    setLoggingMaterialId(materialId);
    setSaving(true);
    setError(null);
    try {
      const result = await logRenovationMaterialExpense({
        projectId: project.id,
        projectName: project.name,
        materialName: m.name,
        amount,
        currency,
        phase: m.phase,
        occurredOn: new Date().toISOString().slice(0, 10),
        locale,
      });
      if (!result.ok) {
        const msg =
          result.error === "fx_failed"
            ? t("logExpenseFxError")
            : result.error === "unauthorized"
              ? t("logExpenseUnauthorized")
              : result.detail?.includes("renovation_project_id")
                ? t("logExpenseProjectIdError")
                : t("logExpenseError");
        setError(msg);
        alert(msg);
        return;
      }
      const next: RenovationProject = {
        ...project,
        materials: project.materials.map((row) =>
          row.id === materialId
            ? { ...row, isPurchased: true, transactionId: result.transactionId }
            : row,
        ),
      };
      setProject(next);
      await persist(next);
    } catch {
      const msg = t("logExpenseError");
      setError(msg);
      alert(msg);
    } finally {
      setLoggingMaterialId(null);
      setSaving(false);
    }
  };

  const exportLabels = {
    sectionBudget: t("export.sectionBudget"),
    sectionByCategory: t("export.sectionByCategory"),
    sectionByPhase: t("export.sectionByPhase"),
    sectionItems: t("export.sectionItems"),
    colCategory: t("materialCategoryLabel"),
    colPhase: t("phaseLabel"),
    colPlanned: t("totalPlanned"),
    colPurchased: t("totalPurchased"),
    colItems: t("export.colItems"),
    colPending: t("export.colPending"),
    colName: t("materialName"),
    colQty: t("quantity"),
    colUnitPrice: t("unitPrice"),
    colLineTotal: t("export.colLineTotal"),
    colRoom: t("roomLabel"),
    colSupply: t("supplyTypeLabel"),
    colStatus: t("export.colStatus"),
    colNote: t("note"),
    statusPurchased: t("purchased"),
    statusPending: t("pending"),
    total: t("export.total"),
    currency: t("currency"),
    budgetCap: t("budgetCap"),
    projectType: t("pickProjectType"),
    printBlocked: t("export.printBlocked"),
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">
          ← {t("backToList")}
        </button>
        <div className="flex flex-wrap gap-2">
          <ListExportButtons
            exportCsvLabel={t("export.csv")}
            exportPdfLabel={t("export.pdf")}
            onCsv={() => exportProjectCsv(project, t, exportLabels, locale)}
            onPdf={() => exportProjectPdf(project, t, exportLabels)}
          />
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setShowEdit(true)}>
            {t("editProject")}
          </Button>
          {!project.completedAt ? (
            <Button type="button" size="sm" className="rounded-full" onClick={completeProject} disabled={saving}>
              {t("markComplete")}
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {saving ? <p className="text-xs text-muted-foreground">{t("saving")}</p> : null}

      {showEdit ? (
        <ProjectForm
          mode="edit"
          initial={project}
          onCancel={() => setShowEdit(false)}
          onSave={async (next) => {
            await persist(next);
            setShowEdit(false);
          }}
        />
      ) : (
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">{project.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("spendTotal", {
              amount: formatProjectMoney(budget.totalPlanned, currency),
              purchased: formatProjectMoney(budget.totalPurchased, currency),
            })}
            {project.completedAt ? ` · ${t("completed")}` : ""}
          </p>
        </div>
      )}

      <ProjectTabBar active={tab} onChange={setTab} />

      {tab === "overview" ? <ProjectOverviewTab project={project} budget={budget} /> : null}
      {tab === "materials" ? (
        <ProjectMaterialsTab
          project={project}
          loggingMaterialId={loggingMaterialId}
          onAddMaterial={addMaterial}
          onUpdateMaterial={updateMaterial}
          onDeleteMaterial={deleteMaterial}
          onLogExpense={(id) => void logExpense(id)}
        />
      ) : null}
    </div>
  );
}
