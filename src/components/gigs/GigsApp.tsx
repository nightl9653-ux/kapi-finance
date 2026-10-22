"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { GigClientForm } from "@/components/gigs/GigClientForm";
import { GigProjectDetail } from "@/components/gigs/GigProjectDetail";
import { GigProjectForm } from "@/components/gigs/GigProjectForm";
import { NudgeControls } from "@/components/gigs/NudgeControls";
import { Button } from "@/components/ui/button";
import { formatProjectMoney } from "@/lib/fx";
import {
  agingBucket,
  clientCurrencyTotals,
  collectUnpaid,
  formatTimeQuantity,
  isChaseDue,
  nudgeInstallment,
  projectTimeQuantity,
  sumUnpaidByCurrency,
  timeUnitForVertical,
  type UnpaidRow,
} from "@/lib/gigs/money";
import { deleteClient, deleteProject, gigsErrorCode, loadGigsStore, upsertClient, upsertProject } from "@/lib/gigs/storage";
import { isoToday, type GigClient, type GigProject, type GigsStore } from "@/lib/gigs/types";
import { cn } from "@/lib/utils";

type Tab = "unpaid" | "projects" | "clients";

const TAB_KEY = "kapi-gigs-tab";

function saveErrorText(
  err: unknown,
  t: (key: "timeSchemaMissing" | "schemaMissing" | "saveError") => string,
): string {
  const code = gigsErrorCode(err);
  if (code === "time_schema") return t("timeSchemaMissing");
  if (code === "schema") return t("schemaMissing");
  return t("saveError");
}

function isSchemaMissing(err: unknown): boolean {
  const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined;
  const msg = err instanceof Error ? err.message : "";
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /studio_clients|studio_projects|schema cache|does not exist/i.test(msg)
  );
}

export function GigsApp({ userId }: { userId: string }) {
  const t = useTranslations("gigs");
  const locale = useLocale();
  const [store, setStore] = useState<GigsStore>({ clients: [], projects: [] });
  const [tab, setTab] = useState<Tab>("unpaid");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [creatingClient, setCreatingClient] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY);
      if (saved === "unpaid" || saved === "projects" || saved === "clients") setTab(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const selectTab = (next: Tab) => {
    setTab(next);
    setActiveProjectId(null);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStore(await loadGigsStore(userId));
    } catch (e) {
      setError(isSchemaMissing(e) ? t("schemaMissing") : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const clientById = useMemo(() => {
    const m = new Map<string, GigClient>();
    for (const c of store.clients) m.set(c.id, c);
    return m;
  }, [store.clients]);

  const unpaid = useMemo(() => collectUnpaid(store.projects), [store.projects]);
  const unpaidSums = useMemo(() => sumUnpaidByCurrency(unpaid), [unpaid]);
  const today = isoToday();
  const orderedUnpaid = useMemo(() => {
    return [...unpaid].sort((a, b) => {
      const ac = isChaseDue(a.nextNudgeOn, today) ? 0 : 1;
      const bc = isChaseDue(b.nextNudgeOn, today) ? 0 : 1;
      return ac - bc;
    });
  }, [unpaid, today]);
  const chaseCount = orderedUnpaid.filter((row) => isChaseDue(row.nextNudgeOn, today)).length;

  async function markNudged(row: UnpaidRow, nextOn: string) {
    const project = store.projects.find((p) => p.id === row.projectId);
    if (!project) return;
    setSaving(true);
    setError(null);
    try {
      setStore(await upsertProject(userId, nudgeInstallment(project, row.installmentId, nextOn, today)));
    } catch (e) {
      setError(saveErrorText(e, t));
    } finally {
      setSaving(false);
    }
  }
  const activeProject = store.projects.find((p) => p.id === activeProjectId);

  if (activeProject) {
    return (
      <GigProjectDetail
        project={activeProject}
        client={clientById.get(activeProject.clientId)}
        clients={store.clients}
        userId={userId}
        onBack={() => setActiveProjectId(null)}
        onStore={setStore}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("workspaceBadge")}</p>
          <h1 className="mt-1 font-serif text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Link href={`/${locale}`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          {t("backToKash")}
        </Link>
      </div>

      <nav className="flex flex-wrap gap-2 border-b pb-3">
        {(
          [
            ["unpaid", t("tabUnpaid")],
            ["projects", t("tabProjects")],
            ["clients", t("tabClients")],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => selectTab(key)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm transition-colors",
              tab === key ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
          <button type="button" className="ml-2 underline" onClick={() => void refresh()}>
            {t("retry")}
          </button>
        </div>
      ) : null}

      {loading ? <p className="text-sm text-muted-foreground">{t("loading")}</p> : null}

      {!loading && tab === "unpaid" ? (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {[...unpaidSums.entries()].map(([cur, amt]) => (
              <div key={cur} className="rounded-2xl border border-amber-200/80 bg-amber-50/40 px-4 py-3">
                <p className="text-xs text-amber-950">{t("totalReceivable")}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-amber-950">
                  {formatProjectMoney(amt, cur)}
                </p>
              </div>
            ))}
            <div className="rounded-2xl border border-rose-200/80 bg-rose-50/50 px-4 py-3">
              <p className="text-xs text-rose-950">{t("chaseToday")}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-rose-950">
                {t("chaseTodayCount", { n: chaseCount })}
              </p>
            </div>
            {unpaidSums.size === 0 ? (
              <p className="w-full text-sm text-muted-foreground">{t("unpaidEmpty")}</p>
            ) : chaseCount === 0 ? (
              <p className="w-full text-sm text-muted-foreground">{t("chaseTodayNone")}</p>
            ) : null}
          </div>
          <ul className="space-y-2">
            {orderedUnpaid.map((row) => {
              const bucket = agingBucket(row.dueOn, today);
              const chase = isChaseDue(row.nextNudgeOn, today);
              return (
                <li
                  key={`${row.projectId}-${row.installmentId}`}
                  className={cn(
                    "space-y-3 rounded-xl border px-4 py-3",
                    chase ? "border-rose-300 bg-rose-50/60" : "bg-white/70",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setActiveProjectId(row.projectId)}>
                      <p className="font-medium">
                        {chase ? `${t("chaseToday")} · ` : ""}
                        {row.projectName} · {row.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {clientById.get(row.clientId)?.name ?? t("unknownClient")}
                        {row.dueOn ? ` · ${t("dueOn")} ${row.dueOn}` : ""}
                        {` · ${t(`aging.${bucket}`)}`}
                        {row.lastNudgedOn ? ` · ${t("nudgedOn", { date: row.lastNudgedOn })}` : ""}
                        {row.nextNudgeOn ? ` · ${t("nextNudge", { date: row.nextNudgeOn })}` : ""}
                      </p>
                    </button>
                    <p className="text-sm font-semibold tabular-nums text-amber-950">
                      {formatProjectMoney(row.outstanding, row.currency)}
                    </p>
                  </div>
                  <NudgeControls
                    rowKey={row.installmentId}
                    nextNudgeOn={row.nextNudgeOn}
                    disabled={saving}
                    onMarkNudged={(nextOn) => void markNudged(row, nextOn)}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {!loading && tab === "projects" ? (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="rounded-full"
              onClick={() => setCreatingProject(true)}
              disabled={store.clients.length === 0}
            >
              {t("newProject")}
            </Button>
            {store.clients.length === 0 ? (
              <p className="self-center text-sm text-muted-foreground">{t("needClientFirst")}</p>
            ) : null}
          </div>
          {creatingProject ? (
            <GigProjectForm
              clients={store.clients}
              saving={saving}
              onCancel={() => setCreatingProject(false)}
              onSave={async (project) => {
                setSaving(true);
                setError(null);
                try {
                  setStore(await upsertProject(userId, project));
                  setCreatingProject(false);
                  setActiveProjectId(project.id);
                } catch (e) {
                  setError(saveErrorText(e, t));
                } finally {
                  setSaving(false);
                }
              }}
            />
          ) : null}
          {store.projects.length === 0 && !creatingProject ? (
            <p className="rounded-2xl border border-dashed bg-white/50 p-6 text-sm text-muted-foreground">
              {t("projectsEmpty")}
            </p>
          ) : (
            <ul className="space-y-2">
              {store.projects.map((p) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  clientName={clientById.get(p.clientId)?.name}
                  onOpen={() => setActiveProjectId(p.id)}
                  onDelete={async () => {
                    if (!confirm(t("confirmDeleteProject"))) return;
                    setSaving(true);
                    try {
                      setStore(await deleteProject(userId, p.id));
                    } catch (e) {
                      setError(saveErrorText(e, t));
                    } finally {
                      setSaving(false);
                    }
                  }}
                  labels={{
                    status: t(`statuses.${p.status}`),
                    vertical: t(`verticals.${p.vertical}`),
                    delete: t("delete"),
                    unknownClient: t("unknownClient"),
                    time:
                      projectTimeQuantity(p) > 0
                        ? t("timeInvested", {
                            qty: formatTimeQuantity(projectTimeQuantity(p)),
                            unit:
                              timeUnitForVertical(p.vertical) === "sessions"
                                ? t("timeUnitSessions")
                                : t("timeUnitHours"),
                          })
                        : undefined,
                  }}
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {!loading && tab === "clients" ? (
        <section className="space-y-4">
          <Button type="button" className="rounded-full" onClick={() => setCreatingClient(true)}>
            {t("newClient")}
          </Button>
          {creatingClient ? (
            <GigClientForm
              saving={saving}
              onCancel={() => setCreatingClient(false)}
              onSave={async (client) => {
                setSaving(true);
                setError(null);
                try {
                  setStore(await upsertClient(userId, client));
                  setCreatingClient(false);
                } catch (e) {
                  setError(saveErrorText(e, t));
                } finally {
                  setSaving(false);
                }
              }}
            />
          ) : null}
          {store.clients.length === 0 && !creatingClient ? (
            <p className="rounded-2xl border border-dashed bg-white/50 p-6 text-sm text-muted-foreground">
              {t("clientsEmpty")}
            </p>
          ) : (
            <ul className="space-y-2">
              {store.clients.map((c) => {
                const totals = clientCurrencyTotals(store.projects, c.id);
                const received = totals.map((row) => formatProjectMoney(row.received, row.currency)).join(" · ");
                const owed = totals.map((row) => formatProjectMoney(row.receivable, row.currency)).join(" · ");
                return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white/70 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[c.company, c.phone, c.email].filter(Boolean).join(" · ") || t("noClientMeta")}
                    </p>
                    <p className="mt-1 text-xs text-foreground/80">
                      {totals.length === 0
                        ? t("clientNoProjects")
                        : `${t("clientReceivedLine", { amounts: received })} · ${t("clientOwesLine", { amounts: owed })}`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={saving}
                    onClick={async () => {
                      if (!confirm(t("confirmDeleteClient"))) return;
                      setSaving(true);
                      try {
                        setStore(await deleteClient(userId, c.id));
                      } catch (e) {
                        setError(saveErrorText(e, t));
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    {t("delete")}
                  </Button>
                </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}

function ProjectRow({
  project,
  clientName,
  onOpen,
  onDelete,
  labels,
}: {
  project: GigProject;
  clientName?: string;
  onOpen: () => void;
  onDelete: () => void;
  labels: { status: string; vertical: string; delete: string; unknownClient: string; time?: string };
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white/70 px-4 py-3">
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
        <p className="font-medium">{project.name}</p>
        <p className="text-xs text-muted-foreground">
          {clientName ?? labels.unknownClient} · {labels.vertical} · {labels.status}
          {labels.time ? ` · ${labels.time}` : ""}
        </p>
      </button>
      <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={onDelete}>
        {labels.delete}
      </Button>
    </li>
  );
}
