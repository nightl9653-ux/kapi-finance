"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { PlantColorPicker } from "@/components/banquet-party/PlantColorPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { decorAtmosphereLabel, decorWearableHintGroupItems, decorWearableHintGroupLabel, decorZoneHint, decorZoneLabel } from "@/lib/banquet-party/decor-labels";
import {
  DECOR_ATMOSPHERE_TAGS,
  DECOR_WEARABLE_HINT_GROUPS,
  DECOR_ZONE_EMOJI,
  DECOR_ZONE_ORDER,
  isDecorCategory,
  sanitizeDecorAtmosphere,
} from "@/lib/banquet-party/decor";
import { drinkTypeDisplay } from "@/lib/banquet-party/drink-labels";
import { DRINK_TYPE_ORDER } from "@/lib/banquet-party/drinks";
import { foodFlavorLabel, foodFlavorsLabel } from "@/lib/banquet-party/flavor-labels";
import { FOOD_FLAVOR_TAGS, isDrinkCategory, isFoodCategory, sanitizeFoodFlavors } from "@/lib/banquet-party/flavors";
import { defaultMenuCourseForCategory, FOOD_MENU_COURSES, inferMenuCourse, menuCourseForSave } from "@/lib/banquet-party/menu";
import { menuCourseLabel } from "@/lib/banquet-party/menu-labels";
import { miscTypeDisplay, miscTypeLabel } from "@/lib/banquet-party/misc-labels";
import { miscTypeHintText } from "@/lib/banquet-party/misc-hints";
import { isMiscCategory, MISC_TYPE_EMOJI, MISC_TYPE_ORDER } from "@/lib/banquet-party/misc";
import type {
  DecorAtmosphereTag,
  DecorZone,
  DrinkType,
  FoodFlavorTag,
  Material,
  MaterialCategory,
  MenuCourse,
  MiscType,
  Plant,
} from "@/lib/banquet-party/types";
import { cn } from "@/lib/utils";

export function MaterialFormDialog({
  mode,
  initial,
  onClose,
  onSave,
}: {
  mode: "add" | "edit";
  initial?: Material;
  onClose: () => void;
  onSave: (m: Omit<Material, "id">) => void;
}) {
  const t = useTranslations("banquetParty");
  const locale = useLocale();
  const [name, setName] = useState(initial?.name ?? "");
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1));
  const [price, setPrice] = useState(initial?.price != null && initial.price > 0 ? String(initial.price) : "");
  const [category, setCategory] = useState<MaterialCategory>(initial?.category ?? "decor");
  const [menuCourse, setMenuCourse] = useState<MenuCourse>(() => inferMenuCourse(initial?.category ?? "decor", initial));
  const [plant, setPlant] = useState<Plant | null>(initial?.plantColor ?? null);
  const [flavor, setFlavor] = useState<FoodFlavorTag[]>(sanitizeFoodFlavors(initial?.flavor));
  const [drinkType, setDrinkType] = useState<DrinkType | "">(initial?.drinkType ?? "");
  const [decorZone, setDecorZone] = useState<DecorZone>(initial?.decorZone ?? "table");
  const [decorAtmosphere, setDecorAtmosphere] = useState<DecorAtmosphereTag[]>(
    sanitizeDecorAtmosphere(initial?.decorAtmosphere),
  );
  const [showAtmosphere, setShowAtmosphere] = useState((initial?.decorAtmosphere?.length ?? 0) > 0);
  const [miscType, setMiscType] = useState<MiscType | "">(initial?.miscType ?? "");
  const [characterNote, setCharacterNote] = useState(initial?.characterNote ?? "");

  const toggleFlavor = (tag: FoodFlavorTag) => {
    setFlavor((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]));
  };

  const toggleAtmosphere = (tag: DecorAtmosphereTag) => {
    setDecorAtmosphere((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Math.max(1, Number(quantity) || 1);
    const unitPrice = Number(price);
    if (!name.trim() || !plant || !Number.isFinite(unitPrice) || unitPrice <= 0) return;
    onSave({
      name: name.trim(),
      quantity: qty,
      price: unitPrice,
      category,
      plantColor: plant,
      isPurchased: initial?.isPurchased ?? false,
      isSetup: initial?.isSetup,
      menuCourse: menuCourseForSave(category, menuCourse),
      flavor: isFoodCategory(category) && flavor.length > 0 ? flavor : undefined,
      drinkType: isDrinkCategory(category) && drinkType ? drinkType : undefined,
      decorZone: isDecorCategory(category) ? decorZone : undefined,
      decorAtmosphere: isDecorCategory(category) && decorAtmosphere.length > 0 ? decorAtmosphere : undefined,
      miscType: isMiscCategory(category) && miscType ? miscType : undefined,
      characterNote: characterNote.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border bg-[#FAF9F7] p-5 shadow-xl">
        <h2 className="text-lg font-semibold">{mode === "add" ? t("addMaterial") : t("editMaterial")}</h2>
        <form onSubmit={submit} className="mt-4 space-y-4" autoComplete="off">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>{t("materialName")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="off" />
            </div>
            <div className="space-y-1">
              <Label>{t("quantity")}</Label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label>{t("unitPrice")}</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                autoComplete="one-time-code"
                name="material-unit-price"
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>{t("materialCategoryLabel")}</Label>
              <select
                className="flex h-9 w-full rounded-md border px-3 text-sm"
                value={category}
                onChange={(e) => {
                  const c = e.target.value as MaterialCategory;
                  setCategory(c);
                  const def = defaultMenuCourseForCategory(c);
                  if (def) setMenuCourse(def);
                }}
              >
                {(["drink", "food", "decor", "misc"] as const).map((c) => (
                  <option key={c} value={c}>
                    {t(`materialCategory.${c}`)}
                  </option>
                ))}
              </select>
            </div>
            {isFoodCategory(category) ? (
              <div className="space-y-1 sm:col-span-2">
                <Label>{t("menuCourseLabel")}</Label>
                <div className="flex flex-wrap gap-2">
                  {FOOD_MENU_COURSES.map((course) => (
                    <button
                      key={course}
                      type="button"
                      onClick={() => setMenuCourse(course)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm",
                        menuCourse === course ? "border-foreground bg-foreground text-background" : "bg-white text-muted-foreground",
                      )}
                    >
                      {menuCourseLabel(t, course)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {isFoodCategory(category) ? (
              <div className="space-y-1 sm:col-span-2">
                <Label>{t("flavorOptional")}</Label>
                <div className="flex flex-wrap gap-2">
                  {FOOD_FLAVOR_TAGS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => toggleFlavor(f)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm",
                        flavor.includes(f) ? "border-foreground bg-foreground text-background" : "bg-white text-muted-foreground",
                      )}
                    >
                      {foodFlavorLabel(t, f)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {isDrinkCategory(category) ? (
              <div className="space-y-1 sm:col-span-2">
                <Label>{t("drinkTypeLabel")}</Label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDrinkType("")}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm",
                      !drinkType ? "border-foreground bg-foreground text-background" : "bg-white text-muted-foreground",
                    )}
                  >
                    {t("drinkTypeNone")}
                  </button>
                  {DRINK_TYPE_ORDER.map((dt) => (
                    <button
                      key={dt}
                      type="button"
                      onClick={() => setDrinkType(dt)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm",
                        drinkType === dt ? "border-foreground bg-foreground text-background" : "bg-white text-muted-foreground",
                      )}
                    >
                      {drinkTypeDisplay(t, dt)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {isDecorCategory(category) ? (
              <div className="space-y-2 sm:col-span-2">
                <Label>{t("decorZoneLabel")}</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {DECOR_ZONE_ORDER.map((zone) => (
                    <button
                      key={zone}
                      type="button"
                      onClick={() => setDecorZone(zone)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-colors",
                        (zone === "wearable" || zone === "avLighting") && "sm:col-span-2",
                        decorZone === zone ? "border-foreground bg-white ring-1 ring-foreground/20" : "bg-white/60 hover:bg-white",
                      )}
                    >
                      <p className="text-sm font-medium">
                        {DECOR_ZONE_EMOJI[zone]} {decorZoneLabel(t, zone)}
                      </p>
                      {zone === "wearable" ? (
                        <div className="mt-1.5 space-y-1">
                          {DECOR_WEARABLE_HINT_GROUPS.map((group) => (
                            <p key={group} className="text-[10px] leading-snug text-muted-foreground">
                              <span className="font-medium text-foreground/70">{decorWearableHintGroupLabel(locale, group)}</span>
                              {" · "}
                              {decorWearableHintGroupItems(locale, group)}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{decorZoneHint(locale, zone)}</p>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline"
                  onClick={() => setShowAtmosphere((v) => !v)}
                >
                  {showAtmosphere ? t("decorAtmosphereHide") : t("decorAtmosphereShow")}
                </button>
                {showAtmosphere ? (
                  <div className="space-y-2 rounded-xl border bg-white/60 p-3">
                    <p className="text-xs font-medium text-muted-foreground">{t("decorAtmosphereGroupTexture")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {DECOR_ATMOSPHERE_TAGS.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleAtmosphere(tag)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs",
                            decorAtmosphere.includes(tag)
                              ? "border-foreground bg-foreground text-background"
                              : "bg-white text-muted-foreground",
                          )}
                        >
                          {decorAtmosphereLabel(t, tag)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {isMiscCategory(category) ? (
              <div className="space-y-2 sm:col-span-2">
                <Label>{t("miscTypeLabel")}</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setMiscType("")}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors sm:col-span-2",
                      !miscType ? "border-foreground bg-white ring-1 ring-foreground/20" : "bg-white/60 hover:bg-white",
                    )}
                  >
                    <p className="text-sm font-medium">{t("miscTypeNone")}</p>
                    <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{t("miscTypeNoneHint")}</p>
                  </button>
                  {MISC_TYPE_ORDER.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setMiscType(type)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-colors",
                        miscType === type ? "border-foreground bg-white ring-1 ring-foreground/20" : "bg-white/60 hover:bg-white",
                      )}
                    >
                      <p className="text-sm font-medium">
                        {MISC_TYPE_EMOJI[type]} {miscTypeLabel(t, type)}
                      </p>
                      <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{miscTypeHintText(locale, type)}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="space-y-1 sm:col-span-2">
              <Label>{t("characterNoteLabel")}</Label>
              <textarea
                value={characterNote}
                onChange={(e) => setCharacterNote(e.target.value)}
                placeholder={t("characterNotePlaceholder")}
                rows={3}
                className={cn(
                  "w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base outline-none",
                  "transition-colors placeholder:text-muted-foreground",
                  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                  "md:text-sm dark:bg-input/30",
                )}
              />
            </div>
          </div>
          <div>
            <Label>{t("pickPlantColor")}</Label>
            <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border bg-white p-3">
              <PlantColorPicker value={plant} onChange={setPlant} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" className="rounded-full" disabled={!plant}>
              {t("saveMaterial")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
