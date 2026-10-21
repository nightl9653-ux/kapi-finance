"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { TripDetailClient } from "@/components/travel/TripDetailClient";
import { TripForm } from "@/components/travel/TripForm";
import { Button } from "@/components/ui/button";
import { BASE_CURRENCY, coerceCurrency, formatProjectMoney } from "@/lib/fx";
import { getTripBudgetSummary } from "@/lib/travel/budget";
import { deleteTrip, loadTrips, upsertTrip } from "@/lib/travel/storage";
import type { TravelTrip } from "@/lib/travel/types";

function isSchemaMissing(err: unknown): boolean {
  const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined;
  const msg = err instanceof Error ? err.message : "";
  return code === "42P01" || code === "PGRST205" || /travel_trips|schema cache|does not exist/i.test(msg);
}

export function TravelApp({ userId }: { userId: string }) {
  const t = useTranslations("travel");
  const locale = useLocale();
  const [trips, setTrips] = useState<TravelTrip[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTrips(await loadTrips(userId));
    } catch (e) {
      setError(isSchemaMissing(e) ? t("schemaMissing") : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const active = trips.find((tr) => tr.id === activeId);

  if (active) {
    return (
      <TripDetailClient
        trip={active}
        userId={userId}
        onBack={() => setActiveId(null)}
        onTripUpdated={setTrips}
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
          {t("newTrip")}
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
        <TripForm
          mode="create"
          onCancel={() => setCreating(false)}
          onSave={async (trip) => {
            setSaving(true);
            setError(null);
            try {
              const updated = await upsertTrip(userId, trip);
              setTrips(updated);
              setCreating(false);
              const opened = updated.find((x) => x.name === trip.name) ?? updated[0];
              setActiveId(opened?.id ?? null);
            } catch (e) {
              setError(isSchemaMissing(e) ? t("schemaMissing") : t("saveError"));
            } finally {
              setSaving(false);
            }
          }}
        />
      ) : null}

      {saving ? <p className="text-xs text-muted-foreground">{t("saving")}</p> : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : trips.length === 0 && !creating ? (
        <div className="rounded-2xl border border-dashed bg-white/50 p-8 text-center">
          <p className="text-sm text-muted-foreground">{t("emptyList")}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {trips.map((trip) => {
            const budget = getTripBudgetSummary(trip);
            const currency = coerceCurrency(trip.currency ?? BASE_CURRENCY);
            return (
              <li key={trip.id} className="rounded-2xl border bg-white/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-3">
                  <button type="button" className="text-left" onClick={() => setActiveId(trip.id)}>
                    <p className="font-medium">{trip.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        trip.destination,
                        trip.startDate,
                        t("itemCount", { n: trip.items.length }),
                        formatProjectMoney(budget.plannedTotal, currency),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </button>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      className="min-h-10 px-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setActiveId(trip.id)}
                    >
                      {t("open")}
                    </button>
                    <button
                      type="button"
                      className="min-h-10 px-2 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (!window.confirm(t("deleteConfirm"))) return;
                        void (async () => {
                          setSaving(true);
                          try {
                            setTrips(await deleteTrip(userId, trip.id));
                          } catch (e) {
                            setError(isSchemaMissing(e) ? t("schemaMissing") : t("saveError"));
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
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
