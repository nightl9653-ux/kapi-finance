"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { MaterialFormDialog } from "@/components/house-renovation/MaterialFormDialog";
import { RenovationAddMaterialButton } from "@/components/house-renovation/RenovationAddMaterialButton";
import { categoryLabel, MATERIAL_CATEGORY_EMOJI, phaseLabel, roomLabel, supplyTypeLabel } from "@/lib/house-renovation/labels";
import { defaultPhaseForType } from "@/lib/house-renovation/phases";
import type { MaterialsSubTab, RenovationMaterial, RenovationProject } from "@/lib/house-renovation/types";
import { BASE_CURRENCY, coerceCurrency, formatProjectMoney } from "@/lib/fx";
import { cn } from "@/lib/utils";

const SUB_TABS: MaterialsSubTab[] = ["all", "purchased", "shopping"];

export function ProjectMaterialsTab({
  project,
  loggingMaterialId,
  onAddMaterial,
  onUpdateMaterial,
  onDeleteMaterial,
  onLogExpense,
}: {
  project: RenovationProject;
  loggingMaterialId?: string | null;
  onAddMaterial: (m: Omit<RenovationMaterial, "id">) => void;
  onUpdateMaterial: (id: string, m: Omit<RenovationMaterial, "id">) => void;
  onDeleteMaterial: (id: string) => void;
  onLogExpense?: (id: string) => void;
}) {
  const t = useTranslations("houseRenovation");
  const currency = coerceCurrency(project.currency ?? BASE_CURRENCY);
  const [sub, setSub] = useState<MaterialsSubTab>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<RenovationMaterial | null>(null);

  const filtered = useMemo(() => {
    if (sub === "shopping") return project.materials.filter((m) => !m.transactionId);
    if (sub === "purchased") return project.materials.filter((m) => Boolean(m.transactionId));
    return project.materials;
  }, [project.materials, sub]);

  return (
    <div className="space-y-4">
      <p className="rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm leading-relaxed text-amber-950/90">
        {t("prepWorkflowHint")}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-full border bg-white/60 p-1">
          {SUB_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setSub(tab)}
              className={cn(
                "rounded-full px-3 py-1 text-xs",
                sub === tab ? "bg-foreground text-background" : "text-muted-foreground",
              )}
            >
              {t(`materialsSubTab.${tab}`)}
            </button>
          ))}
        </div>
        <RenovationAddMaterialButton onClick={() => setShowAdd(true)} />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t("noMaterials")}</p>
      ) : (
        <ul className="divide-y rounded-2xl border bg-white/80">
          {filtered.map((m) => {
            const logging = loggingMaterialId === m.id;
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {MATERIAL_CATEGORY_EMOJI[m.category]} {categoryLabel(t, m.category)} · {phaseLabel(t, m.phase)}
                    {m.room ? ` · ${roomLabel(t, m.room)}` : ""}
                    {m.supplyType ? ` · ${supplyTypeLabel(t, m.supplyType)}` : ""}
                    {m.transactionId ? ` · ${t("loggedToTransactions")}` : null}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="tabular-nums">
                    {m.quantity} × {formatProjectMoney(m.price, currency)} ={" "}
                    {formatProjectMoney(m.quantity * m.price, currency)}
                  </p>
                  <div className="mt-1 flex flex-wrap justify-end gap-2">
                    <span className={cn("text-xs", m.transactionId ? "text-emerald-700" : "text-amber-700")}>
                      {m.transactionId ? t("purchased") : t("pending")}
                    </span>
                    {onLogExpense && !m.transactionId ? (
                      <button
                        type="button"
                        disabled={logging}
                        className="text-xs text-foreground underline-offset-2 hover:underline disabled:opacity-50"
                        onClick={() => onLogExpense(m.id)}
                      >
                        {logging ? t("logExpenseLogging") : t("logExpense")}
                      </button>
                    ) : null}
                    <button type="button" className="text-xs text-muted-foreground" onClick={() => setEditing(m)}>
                      {t("editMaterial")}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => onDeleteMaterial(m.id)}
                    >
                      {t("deleteMaterial")}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showAdd ? (
        <MaterialFormDialog
          projectType={project.projectType}
          defaultPhase={project.currentPhase ?? defaultPhaseForType(project.projectType)}
          mode="add"
          onClose={() => setShowAdd(false)}
          onSave={(m) => {
            onAddMaterial(m);
            setShowAdd(false);
          }}
        />
      ) : null}

      {editing ? (
        <MaterialFormDialog
          projectType={project.projectType}
          defaultPhase={project.currentPhase ?? editing.phase}
          mode="edit"
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(m) => {
            onUpdateMaterial(editing.id, m);
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}
