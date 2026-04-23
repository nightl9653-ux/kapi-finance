"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type Cadence = "daily" | "monthly" | "quarterly" | "yearly";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RecurringFields({ contextDate }: { contextDate?: string }) {
  const t = useTranslations("transactions");
  const common = useTranslations("common");
  const [enabled, setEnabled] = useState(false);
  const [cadence, setCadence] = useState<Cadence>("monthly");
  const [dayOfMonth, setDayOfMonth] = useState("5");
  const [endDate, setEndDate] = useState("");

  const startDate = useMemo(() => contextDate ?? todayISO(), [contextDate]);

  return (
    <div className="mt-2 space-y-3 rounded-xl border bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span className="text-base font-bold text-black">{t("recurringToggle")}</span>
        </label>
        <div className="text-sm font-medium text-muted-foreground">{t("recurringTitle")}</div>
      </div>

      <input type="hidden" name="recurring_enabled" value={enabled ? "1" : ""} />
      <input type="hidden" name="recurring_start_date" value={startDate} />

      {enabled ? (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">{t("recurringUsesAbove")}</div>
          <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="recurring_cadence">{t("recurringCadence")}</Label>
            <select
              id="recurring_cadence"
              name="recurring_cadence"
              value={cadence}
              onChange={(e) => {
                const next = e.target.value as Cadence;
                setCadence(next);
                setDayOfMonth((prev) => {
                  if (next === "daily") return "";
                  return prev || "5";
                });
              }}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="daily">{t("recurringDaily")}</option>
              <option value="monthly">{t("recurringMonthly")}</option>
              <option value="quarterly">{t("recurringQuarterly")}</option>
              <option value="yearly">{t("recurringYearly")}</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurring_day">{t("recurringDayOfMonth")}</Label>
            <Input
              id="recurring_day"
              name="recurring_day_of_month"
              type="number"
              min="1"
              max="28"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
              disabled={cadence === "daily"}
              placeholder={t("recurringDayPlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurring_end">
              {t("recurringEndDate")}
              <span className="ml-1 text-[11px] text-emerald-700/70">{common("optionalInParens")}</span>
            </Label>
            <Input
              id="recurring_end"
              name="recurring_end_date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

