"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { ProjectDetailClient } from "@/components/house-renovation/ProjectDetailClient";
import { ProjectForm } from "@/components/house-renovation/ProjectForm";
import { Button } from "@/components/ui/button";
import { getProjectBudgetSummary } from "@/lib/house-renovation/budget";
import { projectTypeLabel } from "@/lib/house-renovation/labels";
import { deleteProject, loadProjects, upsertProject } from "@/lib/house-renovation/storage";
import type { RenovationProject } from "@/lib/house-renovation/types";
import { BASE_CURRENCY, coerceCurrency, formatProjectMoney } from "@/lib/fx";

export function RenovationApp({ userId }: { userId: string }) {
  const t = useTranslations("houseRenovation");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [projects, setProjects] = useState<RenovationProject[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProjects(await loadProjects(userId));
    } catch {
      setError(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const active = projects.find((p) => p.id === activeId);

  if (active) {
    return (
      <ProjectDetailClient
        project={active}
        userId={userId}
        onBack={() => setActiveId(null)}
        onProjectUpdated={setProjects}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{t("workflowHint")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" className="rounded-full" onClick={() => setCreating(true)}>
          {t("newProject")}
        </Button>
        <Link
          href={`/${locale}/transactions#recent-records`}
          className="self-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {t("linkTransactions")}
        </Link>
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
          <button type="button" className="ml-2 underline" onClick={() => void refresh()}>
            {t("retry")}
          </button>
        </div>
      ) : null}

      {creating ? (
        <ProjectForm
          mode="create"
          onCancel={() => setCreating(false)}
          onSave={async (project) => {
            try {
              const updated = await upsertProject(userId, project);
              setProjects(updated);
              setCreating(false);
              setActiveId(updated[0]?.id ?? null);
            } catch (e) {
              const code = e instanceof Error ? (e as Error & { code?: string }).code : undefined;
              const msg = e instanceof Error ? e.message : "";
              setError(
                code === "PGRST204" && msg.includes("currency")
                  ? t("currencyMigrationError")
                  : t("saveError"),
              );
            }
          }}
        />
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : projects.length === 0 && !creating ? (
        <div className="rounded-2xl border border-dashed bg-white/50 p-8 text-center">
          <p className="text-sm text-muted-foreground">{t("emptyList")}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {projects.map((project) => {
            const budget = getProjectBudgetSummary(project);
            const currency = coerceCurrency(project.currency ?? BASE_CURRENCY);
            return (
              <li key={project.id} className="rounded-2xl border bg-white/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-5">
                  <button type="button" className="text-left" onClick={() => setActiveId(project.id)}>
                    <p className="font-medium">{project.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {projectTypeLabel(t, project.projectType)}
                      {project.areaSqm ? ` · ${project.areaSqm}㎡` : ""}
                      {" · "}
                      {t("materialCount", { n: project.materials.length })}
                      {" · "}
                      {t("plannedSpend", {
                        amount: formatProjectMoney(budget.totalPlanned, currency, { digits: 0 }),
                      })}
                      {project.completedAt ? ` · ${t("completed")}` : ""}
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-12">
                    <button
                      type="button"
                      className="min-h-10 min-w-11 px-1 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setCreating(false);
                        setActiveId(project.id);
                      }}
                    >
                      {tCommon("edit")}
                    </button>
                    <button
                      type="button"
                      className="min-h-10 min-w-11 px-1 text-xs text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        if (!confirm(t("deleteConfirm"))) return;
                        try {
                          setProjects(await deleteProject(userId, project.id));
                        } catch {
                          setError(t("saveError"));
                        }
                      }}
                    >
                      {t("delete")}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
