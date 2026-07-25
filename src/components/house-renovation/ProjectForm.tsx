"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defaultPhaseForType } from "@/lib/house-renovation/phases";
import { newMaterialId, newProjectId } from "@/lib/house-renovation/storage";
import { getProjectTemplate, templatesForType } from "@/lib/house-renovation/templates";
import type { ProjectType, RenovationMaterial, RenovationProject } from "@/lib/house-renovation/types";
import { BASE_CURRENCY, PROJECT_CURRENCIES, coerceCurrency, type Currency } from "@/lib/fx";
import { cn } from "@/lib/utils";

export function ProjectForm({
  mode,
  initial,
  onCancel,
  onSave,
}: {
  mode: "create" | "edit";
  initial?: RenovationProject;
  onCancel: () => void;
  onSave: (project: RenovationProject) => void | Promise<void>;
}) {
  const t = useTranslations("houseRenovation");
  const tCommon = useTranslations("common");
  const [projectType, setProjectType] = useState<ProjectType>(initial?.projectType ?? "renovation");
  const [templateId, setTemplateId] = useState(initial?.templateId ?? "custom");
  const [name, setName] = useState(initial?.name ?? "");
  const [currency, setCurrency] = useState<Currency>(coerceCurrency(initial?.currency ?? BASE_CURRENCY));
  const [areaSqm, setAreaSqm] = useState(initial?.areaSqm?.toString() ?? "");
  const [budgetCap, setBudgetCap] = useState(initial?.budgetCap?.toString() ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [targetEndDate, setTargetEndDate] = useState(initial?.targetEndDate ?? "");
  const [saving, setSaving] = useState(false);

  const templates = templatesForType(projectType);

  useEffect(() => {
    if (mode === "edit") return;
    const tpl = getProjectTemplate(templateId);
    if (!tpl || templateId === "custom") return;
    setName(t(`template.${tpl.nameKey}`));
  }, [templateId, mode, t]);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    if (mode === "edit") return;
    const tpl = getProjectTemplate(id);
    if (!tpl || id === "custom") return;
    setName(t(`template.${tpl.nameKey}`));
    setProjectType(tpl.projectType);
  };

  const buildMaterials = (id: string): RenovationMaterial[] => {
    const tpl = getProjectTemplate(id);
    if (!tpl || id === "custom") return mode === "edit" ? (initial?.materials ?? []) : [];
    if (mode === "edit" && initial?.materials.length) return initial.materials;
    return tpl.materials.map((m) => ({
      id: newMaterialId(),
      name: t(`templateMaterials.${m.nameKey}`),
      quantity: m.quantity,
      price: m.price,
      category: m.category,
      phase: m.phase,
      room: m.room,
      supplyType: m.supplyType,
      isPurchased: false,
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const base: RenovationProject = initial
        ? {
            ...initial,
            name: name.trim(),
            projectType,
            currency,
            templateId: templateId === "custom" ? undefined : templateId,
            areaSqm: areaSqm ? Number(areaSqm) : undefined,
            budgetCap: budgetCap ? Number(budgetCap) : undefined,
            address: address.trim() || undefined,
            startDate: startDate || undefined,
            targetEndDate: targetEndDate || undefined,
            currentPhase: initial.currentPhase ?? defaultPhaseForType(projectType),
            updatedAt: now,
          }
        : {
            id: newProjectId(),
            name: name.trim(),
            projectType,
            currency,
            templateId: templateId === "custom" ? undefined : templateId,
            areaSqm: areaSqm ? Number(areaSqm) : undefined,
            budgetCap: budgetCap ? Number(budgetCap) : undefined,
            address: address.trim() || undefined,
            startDate: startDate || undefined,
            targetEndDate: targetEndDate || undefined,
            currentPhase: defaultPhaseForType(projectType),
            materials: buildMaterials(templateId),
            createdAt: now,
            updatedAt: now,
          };
      await onSave(base);
    } finally {
      setSaving(false);
    }
  };

  const selectedTpl = getProjectTemplate(templateId);

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-gradient-to-br from-[#EDE8E3] to-[#FAF9F7] p-5">
      <h2 className="font-medium">{mode === "create" ? t("createProject") : t("editProject")}</h2>

      {mode === "create" ? (
        <div className="space-y-2">
          <Label>{t("pickProjectType")}</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {(["renovation", "construction"] as ProjectType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setProjectType(type);
                  setTemplateId("custom");
                }}
                className={cn(
                  "rounded-xl border p-3 text-left text-sm transition-colors",
                  projectType === type ? "border-foreground bg-white ring-1 ring-foreground/20" : "bg-white/60 hover:bg-white",
                )}
              >
                <p className="font-medium">{t(`projectType.${type}`)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t(`projectType.${type}Desc`)}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {mode === "create" ? (
        <div className="space-y-2">
          <Label>{t("pickTemplate")}</Label>
          <div className="grid gap-2 sm:grid-cols-1">
            {templates.filter((tpl) => tpl.id !== "custom").map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => applyTemplate(tpl.id)}
                className={cn(
                  "rounded-xl border p-3 text-left text-sm transition-colors",
                  templateId === tpl.id ? "border-foreground bg-white ring-1 ring-foreground/20" : "bg-white/60 hover:bg-white",
                )}
              >
                <p className="font-medium">{t(`template.${tpl.nameKey}`)}</p>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{t(`template.${tpl.descKey}`)}</p>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => applyTemplate("custom")}
            className={cn(
              "w-full rounded-xl border p-3 text-left text-sm",
              templateId === "custom" ? "border-foreground bg-white" : "bg-white/60",
            )}
          >
            {t("template.custom")}
          </button>
          {selectedTpl && templateId !== "custom" ? (
            <p className="text-xs text-muted-foreground">{t(`template.${selectedTpl.descKey}`)}</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1">
        <Label>{t("projectName")}</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("projectNamePlaceholder")} required />
      </div>

      <div className="space-y-1">
        <Label>{t("currency")}</Label>
        <select
          className="flex h-9 w-full rounded-md border bg-white px-3 text-sm"
          value={currency}
          onChange={(e) => setCurrency(coerceCurrency(e.target.value))}
        >
          {PROJECT_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">{t("currencyHint")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>{t("areaSqm")}</Label>
          <Input type="number" min={0} step={0.1} value={areaSqm} onChange={(e) => setAreaSqm(e.target.value)} placeholder="89" />
        </div>
        <div className="space-y-1">
          <Label>{t("budgetCap")}</Label>
          <Input type="number" min={0} value={budgetCap} onChange={(e) => setBudgetCap(e.target.value)} placeholder="150000" />
        </div>
      </div>

      <div className="space-y-1">
        <Label>{t("address")}</Label>
        <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("addressPlaceholder")} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>{t("startDate")}</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>{t("targetEndDate")}</Label>
          <Input type="date" value={targetEndDate} onChange={(e) => setTargetEndDate(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="rounded-full" disabled={saving}>
          {saving ? t("saving") : tCommon("save")}
        </Button>
        <Button type="button" variant="outline" className="rounded-full" onClick={onCancel}>
          {tCommon("cancel")}
        </Button>
      </div>
    </form>
  );
}
