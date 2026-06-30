"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { filterMaterialsForPrep, getPartyBudgetSummary } from "@/lib/banquet-party/budget";
import { drinkTypeDisplay } from "@/lib/banquet-party/drink-labels";
import { groupDrinkMaterials } from "@/lib/banquet-party/drinks";
import { foodFlavorLabel } from "@/lib/banquet-party/flavor-labels";
import { isDrinkCategory, isFoodCategory } from "@/lib/banquet-party/flavors";
import { groupMenuMaterials } from "@/lib/banquet-party/menu";
import { menuCourseLabel } from "@/lib/banquet-party/menu-labels";
import type { Material, MaterialCategory, Party, PrepSubTab } from "@/lib/banquet-party/types";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<MaterialCategory, string> = {
  drink: "🥂",
  food: "🍽️",
  decor: "🎨",
  misc: "✦",
};

const PREP_TABS: PrepSubTab[] = ["budget", "shopping", "menu", "decor"];

function MaterialRow({
  material: m,
  showSetup,
  onTogglePurchased,
  onToggleSetup,
  onEdit,
  onDelete,
}: {
  material: Material;
  showSetup: boolean;
  onTogglePurchased: () => void;
  onToggleSetup?: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("banquetParty");

  return (
    <li className="flex flex-wrap items-center gap-3 p-4">
      <span className="h-8 w-8 shrink-0 rounded-full border" style={{ backgroundColor: m.plantColor.hex }} />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{m.name}</p>
        <p className="text-xs text-muted-foreground">
          {CATEGORY_ICONS[m.category]} {t(`materialCategory.${m.category}`)} · {m.plantColor.colorName}
          {isFoodCategory(m.category) && m.flavor ? ` · ${foodFlavorLabel(t, m.flavor)}` : null}
          {isDrinkCategory(m.category) && m.drinkType ? ` · ${drinkTypeDisplay(t, m.drinkType)}` : null}
          {!isFoodCategory(m.category) && !isDrinkCategory(m.category) && m.texture ? ` · ${t(`texture.${m.texture}`)}` : null}
        </p>
      </div>
      <div className="text-right text-sm">
        <p className="tabular-nums">
          {m.quantity} × {m.price.toFixed(2)} = {(m.quantity * m.price).toFixed(2)}
        </p>
        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            className={cn("text-xs", m.isPurchased ? "text-emerald-700" : "text-amber-700")}
            onClick={onTogglePurchased}
          >
            {m.isPurchased ? t("purchased") : t("pending")}
          </button>
          {showSetup && onToggleSetup ? (
            <button
              type="button"
              className={cn("text-xs", m.isSetup ? "text-emerald-700" : "text-muted-foreground")}
              onClick={onToggleSetup}
            >
              {m.isSetup ? t("decorSetupDone") : t("decorSetupPending")}
            </button>
          ) : null}
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={onEdit}>
            {t("editMaterial")}
          </button>
          <button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={onDelete}>
            {t("deleteMaterial")}
          </button>
        </div>
      </div>
    </li>
  );
}

export function PartyPrepTab({
  party,
  onAddMaterial,
  onTogglePurchased,
  onToggleSetup,
  onEditMaterial,
  onDeleteMaterial,
}: {
  party: Party;
  onAddMaterial: () => void;
  onTogglePurchased: (id: string) => void;
  onToggleSetup: (id: string) => void;
  onEditMaterial: (m: Material) => void;
  onDeleteMaterial: (id: string) => void;
}) {
  const t = useTranslations("banquetParty");
  const [sub, setSub] = useState<PrepSubTab>("budget");
  const budget = getPartyBudgetSummary(party);

  const listMaterials =
    sub === "budget"
      ? []
      : sub === "shopping"
        ? party.materials
        : filterMaterialsForPrep(party.materials, sub);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {PREP_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setSub(tab)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm",
              sub === tab ? "border-foreground bg-foreground text-background" : "bg-white text-muted-foreground",
            )}
          >
            {t(`prep.${tab}`)}
          </button>
        ))}
      </div>

      {sub === "budget" ? (
        <div className="overflow-hidden rounded-2xl border bg-white/80">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                <th className="p-3 font-medium">{t("budgetCategory")}</th>
                <th className="p-3 font-medium">{t("budgetPlanned")}</th>
                <th className="p-3 font-medium">{t("budgetPurchased")}</th>
                <th className="hidden p-3 font-medium sm:table-cell">{t("budgetItems")}</th>
              </tr>
            </thead>
            <tbody>
              {budget.byCategory.map((row) => (
                <tr key={row.category} className="border-b last:border-0">
                  <td className="p-3">
                    {CATEGORY_ICONS[row.category]} {t(`materialCategory.${row.category}`)}
                  </td>
                  <td className="p-3 tabular-nums">¥{row.planned.toFixed(2)}</td>
                  <td className="p-3 tabular-nums">¥{row.purchased.toFixed(2)}</td>
                  <td className="hidden p-3 text-muted-foreground sm:table-cell">
                    {row.itemCount} · {t("budgetPendingCount", { n: row.pendingCount })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/20 font-medium">
                <td className="p-3">{t("budgetTotal")}</td>
                <td className="p-3 tabular-nums">¥{budget.totalPlanned.toFixed(2)}</td>
                <td className="p-3 tabular-nums">¥{budget.totalPurchased.toFixed(2)}</td>
                <td className="hidden p-3 sm:table-cell">{t("budgetPendingCount", { n: budget.totalPending })}</td>
              </tr>
            </tfoot>
          </table>
          {budget.decorSetupTotal > 0 ? (
            <p className="border-t p-3 text-xs text-muted-foreground">
              {t("decorSetupProgress", { done: budget.decorSetupDone, total: budget.decorSetupTotal })}
            </p>
          ) : null}
        </div>
      ) : sub === "menu" ? (
        <div className="space-y-4">
          {groupMenuMaterials(party.materials).length === 0 ? (
            <p className="rounded-2xl border bg-white/80 p-6 text-sm text-muted-foreground">{t("noMenuItems")}</p>
          ) : (
            groupMenuMaterials(party.materials).map(({ course, items }) => (
              <div key={course} className="overflow-hidden rounded-2xl border bg-white/80">
                <div className="border-b bg-muted/20 px-4 py-2">
                  <p className="text-sm font-medium">{menuCourseLabel(t, course)}</p>
                  <p className="text-xs text-muted-foreground">{t("menuCourseCount", { n: items.length })}</p>
                </div>
                {course === "drink" ? (
                  groupDrinkMaterials(items).map(({ drinkType, items: drinkItems }) => (
                    <div key={drinkType} className="border-b last:border-0">
                      <div className="bg-muted/10 px-4 py-2">
                        <p className="text-xs font-medium">{drinkTypeDisplay(t, drinkType)}</p>
                        <p className="text-[10px] text-muted-foreground">{t("menuCourseCount", { n: drinkItems.length })}</p>
                      </div>
                      <ul className="divide-y">
                        {drinkItems.map((m) => (
                          <MaterialRow
                            key={m.id}
                            material={m}
                            showSetup={false}
                            onTogglePurchased={() => onTogglePurchased(m.id)}
                            onEdit={() => onEditMaterial(m)}
                            onDelete={() => onDeleteMaterial(m.id)}
                          />
                        ))}
                      </ul>
                    </div>
                  ))
                ) : (
                  <ul className="divide-y">
                    {items.map((m) => (
                      <MaterialRow
                        key={m.id}
                        material={m}
                        showSetup={false}
                        onTogglePurchased={() => onTogglePurchased(m.id)}
                        onEdit={() => onEditMaterial(m)}
                        onDelete={() => onDeleteMaterial(m.id)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="rounded-2xl border bg-white/80">
          {listMaterials.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              {sub === "decor" ? t("noDecorItems") : t("noMaterials")}
            </p>
          ) : (
            <ul className="divide-y">
              {listMaterials.map((m) => (
                <MaterialRow
                  key={m.id}
                  material={m}
                  showSetup={sub === "decor"}
                  onTogglePurchased={() => onTogglePurchased(m.id)}
                  onToggleSetup={sub === "decor" ? () => onToggleSetup(m.id) : undefined}
                  onEdit={() => onEditMaterial(m)}
                  onDelete={() => onDeleteMaterial(m.id)}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        type="button"
        className="w-full rounded-full border border-dashed py-2.5 text-sm text-muted-foreground hover:border-foreground hover:text-foreground"
        onClick={onAddMaterial}
      >
        + {t("addMaterial")}
      </button>
    </div>
  );
}
