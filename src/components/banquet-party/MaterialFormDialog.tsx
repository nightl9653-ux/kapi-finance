"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { PlantColorPicker } from "@/components/banquet-party/PlantColorPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { drinkTypeDisplay } from "@/lib/banquet-party/drink-labels";
import { DRINK_TYPE_ORDER } from "@/lib/banquet-party/drinks";
import { foodFlavorLabel } from "@/lib/banquet-party/flavor-labels";
import { FOOD_FLAVOR_TAGS, isDrinkCategory, isFoodCategory } from "@/lib/banquet-party/flavors";
import { defaultMenuCourseForCategory, FOOD_MENU_COURSES, inferMenuCourse, menuCourseForSave } from "@/lib/banquet-party/menu";
import { menuCourseLabel } from "@/lib/banquet-party/menu-labels";
import type { DrinkType, FoodFlavorTag, Material, MaterialCategory, MenuCourse, Plant, TextureTag } from "@/lib/banquet-party/types";
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
  const [name, setName] = useState(initial?.name ?? "");
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const [price, setPrice] = useState(initial?.price ?? 0);
  const [category, setCategory] = useState<MaterialCategory>(initial?.category ?? "decor");
  const [menuCourse, setMenuCourse] = useState<MenuCourse>(() => inferMenuCourse(initial?.category ?? "decor", initial));
  const [plant, setPlant] = useState<Plant | null>(initial?.plantColor ?? null);
  const [flavor, setFlavor] = useState<FoodFlavorTag | "">(initial?.flavor ?? "");
  const [drinkType, setDrinkType] = useState<DrinkType | "">(initial?.drinkType ?? "");
  const [texture, setTexture] = useState<TextureTag | "">(initial?.texture ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !plant || price <= 0) return;
    onSave({
      name: name.trim(),
      quantity,
      price,
      category,
      plantColor: plant,
      isPurchased: initial?.isPurchased ?? false,
      isSetup: initial?.isSetup,
      menuCourse: menuCourseForSave(category, menuCourse),
      flavor: isFoodCategory(category) && flavor ? flavor : undefined,
      drinkType: isDrinkCategory(category) && drinkType ? drinkType : undefined,
      texture: !isFoodCategory(category) && !isDrinkCategory(category) && texture ? texture : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border bg-[#FAF9F7] p-5 shadow-xl">
        <h2 className="text-lg font-semibold">{mode === "add" ? t("addMaterial") : t("editMaterial")}</h2>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>{t("materialName")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>{t("quantity")}</Label>
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>{t("unitPrice")}</Label>
              <Input type="number" min={0} step={0.01} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
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
                  <button
                    type="button"
                    onClick={() => setFlavor("")}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm",
                      !flavor ? "border-foreground bg-foreground text-background" : "bg-white text-muted-foreground",
                    )}
                  >
                    {t("flavorNone")}
                  </button>
                  {FOOD_FLAVOR_TAGS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFlavor(f)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm",
                        flavor === f ? "border-foreground bg-foreground text-background" : "bg-white text-muted-foreground",
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
            {!isFoodCategory(category) && !isDrinkCategory(category) ? (
              <div className="space-y-1 sm:col-span-2">
                <Label>{t("textureOptional")}</Label>
                <select
                  className="flex h-9 w-full rounded-md border px-3 text-sm"
                  value={texture}
                  onChange={(e) => setTexture(e.target.value as TextureTag | "")}
                >
                  <option value="">{t("textureNone")}</option>
                  {(["metal", "glossy", "natural", "transparent", "soft"] as const).map((tx) => (
                    <option key={tx} value={tx}>
                      {t(`texture.${tx}`)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
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
