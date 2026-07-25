"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { PartyDetailClient } from "@/components/banquet-party/PartyDetailClient";
import { PartyForm } from "@/components/banquet-party/PartyForm";
import { Button } from "@/components/ui/button";
import { calculateColorPalette } from "@/lib/banquet-party/palette";
import { deleteParty, loadParties, upsertParty } from "@/lib/banquet-party/storage";
import type { Party } from "@/lib/banquet-party/types";

export function BanquetPartyApp({ userId }: { userId: string }) {
  const t = useTranslations("banquetParty");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [parties, setParties] = useState<Party[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setParties(await loadParties(userId));
    } catch {
      setError(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const active = parties.find((p) => p.id === activeId);

  if (active) {
    return (
      <PartyDetailClient
        party={active}
        userId={userId}
        onBack={() => setActiveId(null)}
        onPartyUpdated={setParties}
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
          {t("newParty")}
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
        <PartyForm
          mode="create"
          onCancel={() => setCreating(false)}
          onSave={async (party) => {
            setSaving(true);
            setError(null);
            try {
              const updated = await upsertParty(userId, party);
              setParties(updated);
              setCreating(false);
              const opened =
                updated.find((p) => p.name === party.name && p.date === party.date) ?? updated[0];
              setActiveId(opened?.id ?? null);
            } catch (e) {
              const code = e instanceof Error ? (e as Error & { code?: string }).code : undefined;
              const msg = e instanceof Error ? e.message : "";
              setError(
                code === "PGRST204" && msg.includes("currency")
                  ? t("currencyMigrationError")
                  : code === "PGRST204" && msg.includes("budget_cap")
                    ? t("budgetCapMigrationError")
                    : t("saveError"),
              );
            } finally {
              setSaving(false);
            }
          }}
        />
      ) : null}

      {saving ? <p className="text-xs text-muted-foreground">{t("saving")}</p> : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : parties.length === 0 && !creating ? (
        <div className="rounded-2xl border border-dashed bg-white/50 p-8 text-center">
          <p className="text-sm text-muted-foreground">{t("emptyList")}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {parties.map((party) => {
            const palette = party.colorPalette ?? calculateColorPalette(party.materials);
            return (
              <li key={party.id} className="rounded-2xl border bg-white/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-5">
                  <button type="button" className="text-left" onClick={() => setActiveId(party.id)}>
                    <p className="font-medium">{party.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {party.date} · {t("materialCount", { n: party.materials.length })}
                      {party.completedAt ? ` · ${t("completed")}` : ""}
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-12">
                    <button
                      type="button"
                      className="min-h-10 min-w-11 px-1 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setCreating(false);
                        setActiveId(party.id);
                      }}
                    >
                      {tCommon("edit")}
                    </button>
                    <button
                      type="button"
                      className="min-h-10 min-w-11 px-1 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (!confirm(t("deleteConfirm"))) return;
                        void (async () => {
                          setSaving(true);
                          setError(null);
                          try {
                            setParties(await deleteParty(userId, party.id));
                          } catch {
                            setError(t("saveError"));
                          } finally {
                            setSaving(false);
                          }
                        })();
                      }}
                    >
                      {t("delete")}
                    </button>
                  </div>
                </div>
                {palette.distribution.length > 0 ? (
                  <div className="mt-3 flex gap-1">
                    {palette.distribution.slice(0, 6).map((d) => {
                      const hex = party.materials.find((m) => m.plantColor.id === d.plantId)?.plantColor.hex ?? "#ccc";
                      return (
                        <span
                          key={d.plantId}
                          className="h-2 flex-1 rounded-full"
                          style={{ backgroundColor: hex }}
                          title={`${d.percentage}%`}
                        />
                      );
                    })}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
