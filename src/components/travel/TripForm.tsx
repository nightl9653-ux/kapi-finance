"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BASE_CURRENCY, PROJECT_CURRENCIES, coerceCurrency } from "@/lib/fx";
import { itemsFromTemplate, type TravelTemplateId } from "@/lib/travel/templates";
import { newTravelId, type TravelTrip } from "@/lib/travel/types";

export function TripForm({
  mode,
  initial,
  onCancel,
  onSave,
}: {
  mode: "create" | "edit";
  initial?: TravelTrip;
  onCancel: () => void;
  onSave: (trip: TravelTrip) => void | Promise<void>;
}) {
  const t = useTranslations("travel");
  const [name, setName] = useState(initial?.name ?? "");
  const [destination, setDestination] = useState(initial?.destination ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? BASE_CURRENCY);
  const [budgetCap, setBudgetCap] = useState(
    initial?.budgetCap != null ? String(initial.budgetCap) : "",
  );
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [templateId, setTemplateId] = useState<TravelTemplateId | "blank">(
    mode === "create" ? "weekend" : "blank",
  );
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const cap = budgetCap.trim() ? Number(budgetCap) : undefined;
      const trip: TravelTrip = {
        id: initial?.id ?? newTravelId(),
        name: trimmed,
        destination: destination.trim() || undefined,
        currency: coerceCurrency(currency),
        budgetCap: Number.isFinite(cap) && (cap as number) > 0 ? (cap as number) : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        notes: notes.trim() || undefined,
        items:
          mode === "create" && templateId !== "blank"
            ? itemsFromTemplate(templateId)
            : (initial?.items ?? []),
        createdAt: initial?.createdAt ?? now,
        updatedAt: now,
        completedAt: initial?.completedAt,
      };
      await onSave(trip);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border bg-white/70 p-4">
      <h2 className="text-base font-medium">{mode === "create" ? t("newTrip") : t("editTrip")}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="trip-name">{t("tripName")}</Label>
          <Input
            id="trip-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("tripNamePlaceholder")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="trip-dest">{t("destination")}</Label>
          <Input
            id="trip-dest"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder={t("destinationPlaceholder")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="trip-currency">{t("currency")}</Label>
          <select
            id="trip-currency"
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
            value={currency}
            onChange={(e) => setCurrency(coerceCurrency(e.target.value))}
          >
            {PROJECT_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="trip-start">{t("startDate")}</Label>
          <Input id="trip-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="trip-end">{t("endDate")}</Label>
          <Input id="trip-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="trip-cap">{t("budgetCap")}</Label>
          <Input
            id="trip-cap"
            type="number"
            min="0"
            step="0.01"
            value={budgetCap}
            onChange={(e) => setBudgetCap(e.target.value)}
            placeholder={t("budgetCapPlaceholder")}
          />
        </div>
        {mode === "create" ? (
          <div className="space-y-1.5">
            <Label htmlFor="trip-template">{t("template")}</Label>
            <select
              id="trip-template"
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value as TravelTemplateId | "blank")}
            >
              <option value="weekend">{t("templateWeekend")}</option>
              <option value="family">{t("templateFamily")}</option>
              <option value="business">{t("templateBusiness")}</option>
              <option value="blank">{t("templateBlank")}</option>
            </select>
          </div>
        ) : null}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="trip-notes">{t("notes")}</Label>
          <Input id="trip-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("currencyHint")}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="rounded-full" disabled={submitting || !name.trim()} onClick={() => void submit()}>
          {mode === "create" ? t("createAndOpen") : t("save")}
        </Button>
        <Button type="button" variant="outline" className="rounded-full" disabled={submitting} onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
