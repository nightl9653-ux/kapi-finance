"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BASE_CURRENCY, PROJECT_CURRENCIES, coerceCurrency } from "@/lib/fx";
import { endDateFromTripDays, inclusiveTripDays } from "@/lib/local-date";
import {
  TRAVEL_TEMPLATES,
  clampPartySize,
  clampTripDays,
  getTravelTemplate,
  itemsFromTemplate,
  type TravelTemplateId,
} from "@/lib/travel/templates";
import { newTravelId, type TravelTrip } from "@/lib/travel/types";

const weekendDefaults = getTravelTemplate("weekend");

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
  const [days, setDays] = useState(String(weekendDefaults.defaultDays));
  const [people, setPeople] = useState(String(weekendDefaults.defaultPeople));
  const [submitting, setSubmitting] = useState(false);

  const usesTemplate = mode === "create" && templateId !== "blank";

  const applySpan = (start: string, dayCount: number) => {
    const end = endDateFromTripDays(start, dayCount);
    if (end) setEndDate(end);
  };

  const onTemplate = (id: TravelTemplateId | "blank") => {
    setTemplateId(id);
    if (id === "blank") return;
    const tpl = getTravelTemplate(id);
    setDays(String(tpl.defaultDays));
    setPeople(String(tpl.defaultPeople));
    if (startDate) applySpan(startDate, tpl.defaultDays);
  };

  const onDays = (raw: string) => {
    setDays(raw);
    const n = Number(raw);
    if (!startDate || !Number.isFinite(n) || n < 1) return;
    applySpan(startDate, clampTripDays(n));
  };

  const onPeople = (raw: string) => {
    setPeople(raw);
  };

  const onStart = (value: string) => {
    setStartDate(value);
    if (!usesTemplate || !value) return;
    const n = clampTripDays(Number(days), getTravelTemplate(templateId).defaultDays);
    applySpan(value, n);
  };

  const onEnd = (value: string) => {
    setEndDate(value);
    if (!usesTemplate || !startDate || !value) return;
    const n = inclusiveTripDays(startDate, value);
    if (n == null) return;
    const clamped = clampTripDays(n);
    setDays(String(clamped));
    if (clamped !== n) applySpan(startDate, clamped);
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const cap = budgetCap.trim() ? Number(budgetCap) : undefined;
      const tpl = usesTemplate ? getTravelTemplate(templateId) : undefined;
      const dayCount = clampTripDays(Number(days), tpl?.defaultDays ?? 1);
      const party = clampPartySize(Number(people), tpl?.defaultPeople ?? 1);
      const trip: TravelTrip = {
        id: initial?.id ?? newTravelId(),
        name: trimmed,
        destination: destination.trim() || undefined,
        currency: coerceCurrency(currency),
        budgetCap: Number.isFinite(cap) && (cap as number) > 0 ? (cap as number) : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        notes: notes.trim() || undefined,
        items: tpl
          ? itemsFromTemplate(tpl.id, { days: dayCount, people: party }, (key) => t(`templateItems.${key}`))
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
          <Input id="trip-start" type="date" value={startDate} onChange={(e) => onStart(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="trip-end">{t("endDate")}</Label>
          <Input id="trip-end" type="date" value={endDate} onChange={(e) => onEnd(e.target.value)} />
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
              onChange={(e) => onTemplate(e.target.value as TravelTemplateId | "blank")}
            >
              {TRAVEL_TEMPLATES.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {t(tpl.labelKey)}
                </option>
              ))}
              <option value="blank">{t("templateBlank")}</option>
            </select>
          </div>
        ) : null}
        {usesTemplate ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="trip-days">{t("tripDays")}</Label>
              <Input
                id="trip-days"
                type="number"
                min={1}
                max={60}
                step={1}
                value={days}
                onChange={(e) => onDays(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trip-people">{t("partySize")}</Label>
              <Input
                id="trip-people"
                type="number"
                min={1}
                max={30}
                step={1}
                value={people}
                onChange={(e) => onPeople(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">{t("scaleHint")}</p>
          </>
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
