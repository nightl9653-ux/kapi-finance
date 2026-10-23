"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SOUL_CHARACTERS } from "@/lib/banquet-party/characters";
import { getPlant } from "@/lib/banquet-party/plants";
import { defaultMenuCourseForCategory } from "@/lib/banquet-party/menu";
import { newMaterialId, newPartyId, newTimelineTaskId } from "@/lib/banquet-party/storage";
import { createDefaultTimeline } from "@/lib/banquet-party/timeline";
import {
  PARTY_STYLE_IDS,
  PARTY_STYLE_ITEMS,
  type PartyStyleId,
} from "@/lib/banquet-party/style-materials";
import { EXTENDED_PARTY_TEMPLATES, FEATURED_PARTY_TEMPLATES, getPartyTemplate, isFeaturedPartyTemplate } from "@/lib/banquet-party/templates";
import type { Material, Party } from "@/lib/banquet-party/types";
import { BASE_CURRENCY, PROJECT_CURRENCIES, coerceCurrency, type Currency } from "@/lib/fx";
import { cn } from "@/lib/utils";

export function PartyForm({
  mode,
  initial,
  onCancel,
  onSave,
}: {
  mode: "create" | "edit";
  initial?: Party;
  onCancel: () => void;
  onSave: (party: Party) => void | Promise<void>;
}) {
  const t = useTranslations("banquetParty");
  const locale = useLocale();
  const [partyTypeId, setPartyTypeId] = useState(initial?.partyTypeId ?? "custom");
  const [styles, setStyles] = useState<PartyStyleId[]>(["minimal"]);
  const [name, setName] = useState(initial?.name ?? "");
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [characterId, setCharacterId] = useState(initial?.characterId ?? SOUL_CHARACTERS[0]!.id);
  const [currency, setCurrency] = useState<Currency>(coerceCurrency(initial?.currency ?? BASE_CURRENCY));
  const [budgetCap, setBudgetCap] = useState(initial?.budgetCap?.toString() ?? "");
  const [submitting, setSubmitting] = useState(false);

  const applyTemplate = (typeId: string) => {
    setPartyTypeId(typeId);
    if (mode === "edit") return;
    const tpl = getPartyTemplate(typeId);
    if (!tpl) return;
    if (typeId !== "custom") {
      setName(t(`partyType.${tpl.nameKey}`));
      setCharacterId(tpl.characterId);
    }
  };

  const toggleStyle = (id: PartyStyleId) => {
    setStyles((current) => (current.includes(id) ? current.filter((style) => style !== id) : [...current, id]));
  };

  const buildMaterialsFromTemplate = (typeId: string): Material[] => {
    const tpl = getPartyTemplate(typeId);
    if (!tpl || typeId === "custom" || tpl.materials.length === 0) return [];
    return tpl.materials.flatMap((m) => {
      const plant = getPlant(m.plantId);
      if (!plant) return [];
      return [
        {
          id: newMaterialId(),
          name: t(`templateMaterials.${m.nameKey}`),
          quantity: m.quantity,
          price: m.price,
          category: m.category,
          plantColor: plant,
          isPurchased: false,
          miscType: m.miscType,
          flavor: m.flavor,
          drinkType: m.drinkType,
          decorZone: m.decorZone,
          decorAtmosphere: m.decorAtmosphere,
          menuCourse: m.menuCourse ?? defaultMenuCourseForCategory(m.category),
        },
      ];
    });
  };

  const buildCreateMaterials = (): Material[] => {
    const seen = new Set<string>();
    const out: Material[] = [];
    const push = (material: Material) => {
      const key = material.name.trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(material);
    };
    if (styles.includes("minimal")) {
      for (const material of buildMaterialsFromTemplate(partyTypeId)) push(material);
    }
    const plant = getPlant("pennisetum");
    if (!plant) return out;
    for (const styleId of PARTY_STYLE_IDS) {
      if (styleId === "minimal" || !styles.includes(styleId)) continue;
      for (const seed of PARTY_STYLE_ITEMS[styleId]) {
        push({
          id: newMaterialId(),
          name: locale === "en" ? seed.nameEn : seed.nameZh,
          quantity: 1,
          price: 0,
          category: seed.category,
          plantColor: plant,
          isPurchased: false,
          miscType: seed.miscType,
          drinkType: seed.drinkType,
          decorZone: seed.decorZone,
          menuCourse: seed.menuCourse ?? defaultMenuCourseForCategory(seed.category),
        });
      }
    }
    return out;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;

    const cap = budgetCap.trim() ? Number(budgetCap) : undefined;
    const parsedCap = Number.isFinite(cap) && cap! > 0 ? cap : undefined;

    const base: Party = initial
      ? {
          ...initial,
          name: name.trim(),
          date,
          characterId,
          currency,
          budgetCap: parsedCap,
          partyTypeId: partyTypeId === "custom" ? undefined : partyTypeId,
        }
      : {
          id: newPartyId(),
          name: name.trim(),
          date,
          characterId,
          currency,
          budgetCap: parsedCap,
          partyTypeId: partyTypeId === "custom" ? undefined : partyTypeId,
          materials: buildCreateMaterials(),
          colorPalette: { primary: null, secondaries: [], accents: [], distribution: [] },
          guests: [],
          timeline: createDefaultTimeline(newTimelineTaskId),
          createdAt: new Date().toISOString(),
        };

    setSubmitting(true);
    void Promise.resolve(onSave(base)).finally(() => setSubmitting(false));
  };

  const selectedTpl = getPartyTemplate(partyTypeId);
  const dropdownValue = isFeaturedPartyTemplate(partyTypeId) ? "" : partyTypeId;

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-gradient-to-br from-[#F4EFEA] to-[#FAF9F7] p-5">
      <h2 className="font-medium">{mode === "create" ? t("createParty") : t("editParty")}</h2>

      <div className="space-y-2">
        <Label>{t("pickPartyType")}</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {FEATURED_PARTY_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => applyTemplate(tpl.id)}
              className={cn(
                "rounded-xl border p-3 text-left text-sm transition-colors",
                partyTypeId === tpl.id ? "border-foreground bg-white ring-1 ring-foreground/20" : "bg-white/60 hover:bg-white",
              )}
            >
              <p className="font-medium">{t(`partyType.${tpl.nameKey}`)}</p>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{t(`partyType.${tpl.descKey}`)}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <Label>{t("partyTypeMoreLabel")}</Label>
        <select
          className="flex h-9 w-full rounded-md border bg-white px-3 text-sm"
          value={dropdownValue}
          onChange={(e) => applyTemplate(e.target.value)}
        >
          <option value="">{t("partyTypeMorePlaceholder")}</option>
          {EXTENDED_PARTY_TEMPLATES.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {t(`partyType.${tpl.nameKey}`)}
            </option>
          ))}
        </select>
        {selectedTpl && !isFeaturedPartyTemplate(partyTypeId) ? (
          <p className="text-xs leading-relaxed text-muted-foreground">{t(`partyType.${selectedTpl.descKey}`)}</p>
        ) : null}
      </div>

      {mode === "create" ? (
        <div className="space-y-2">
          <Label>{t("pickPartyStyle")}</Label>
          <p className="text-xs text-muted-foreground">{t("partyStyleHint")}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PARTY_STYLE_IDS.map((styleId) => {
              const selected = styles.includes(styleId);
              const count = styleId === "minimal" ? null : PARTY_STYLE_ITEMS[styleId].length;
              return (
                <button
                  key={styleId}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleStyle(styleId)}
                  className={cn(
                    "rounded-xl border p-3 text-left text-sm transition-colors",
                    selected ? "border-foreground bg-white ring-1 ring-foreground/20" : "bg-white/60 hover:bg-white",
                  )}
                >
                  <p className="font-medium">{t(`partyStyle.${styleId}`)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {styleId === "minimal" ? t("partyStyleMinimalHint") : t("partyStyleCount", { n: count ?? 0 })}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {mode === "create" && partyTypeId === "daughterBirthday" ? (
        <p className="text-xs text-muted-foreground">{t("daughterBirthdayHint")}</p>
      ) : null}
      {mode === "create" && partyTypeId === "gardenDinner" ? (
        <p className="text-xs text-muted-foreground">{t("gardenDinnerHint")}</p>
      ) : null}
      {mode === "create" && partyTypeId === "networkingSalon" ? (
        <p className="text-xs text-muted-foreground">{t("networkingSalonHint")}</p>
      ) : null}

      <div className="space-y-1">
        <Label>{t("partyName")}</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("partyNamePlaceholder")} required />
      </div>
      <div className="space-y-1">
        <Label>{t("partyDate")}</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
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
      <div className="space-y-1">
        <Label>{t("budgetCap")}</Label>
        <Input
          type="number"
          min={0}
          value={budgetCap}
          onChange={(e) => setBudgetCap(e.target.value)}
          placeholder={t("budgetCapPlaceholder")}
        />
        <p className="text-xs text-muted-foreground">{t("budgetCapHint")}</p>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="rounded-full" onClick={onCancel} disabled={submitting}>
          {t("cancel")}
        </Button>
        <Button type="submit" className="rounded-full" disabled={submitting}>
          {mode === "create" ? t("createAndOpen") : t("saveParty")}
        </Button>
      </div>
    </form>
  );
}
