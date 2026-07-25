"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { filterMaterialsForPrep, getPartyBudgetSummary } from "@/lib/banquet-party/budget";
import { decorAtmosphereLabel, decorZoneDisplay } from "@/lib/banquet-party/decor-labels";
import { groupDecorMaterials, isDecorCategory, sanitizeDecorAtmosphere } from "@/lib/banquet-party/decor";
import { drinkTypeDisplay } from "@/lib/banquet-party/drink-labels";
import { groupDrinkMaterials } from "@/lib/banquet-party/drinks";
import { foodFlavorsLabel } from "@/lib/banquet-party/flavor-labels";
import { isDrinkCategory, isFoodCategory, sanitizeFoodFlavors } from "@/lib/banquet-party/flavors";
import { groupMenuMaterials } from "@/lib/banquet-party/menu";
import { menuCourseLabel } from "@/lib/banquet-party/menu-labels";
import { miscTypeDisplay } from "@/lib/banquet-party/misc-labels";
import { miscTypeHintText } from "@/lib/banquet-party/misc-hints";
import { groupMiscMaterials, isMiscCategory, resolveMiscType } from "@/lib/banquet-party/misc";
import type { Material, MaterialCategory, Party, PrepSubTab } from "@/lib/banquet-party/types";
import { BASE_CURRENCY, coerceCurrency, formatProjectMoney, type Currency } from "@/lib/fx";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<MaterialCategory, string> = {
  drink: "🥂",
  food: "🍽️",
  decor: "🎨",
  misc: "✦",
};

const PREP_TABS: PrepSubTab[] = ["budget", "shopping", "menu", "decor", "misc"];

function MaterialRow({
  material: m,
  currency,
  logging,
  showSetup,
  onToggleSetup,
  onEdit,
  onDelete,
  onLogExpense,
}: {
  material: Material;
  currency: Currency;
  logging?: boolean;
  showSetup: boolean;
  onToggleSetup?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onLogExpense?: () => void;
}) {
  const t = useTranslations("banquetParty");

  return (
    <li className="flex flex-wrap items-center gap-3 p-4">
      <span className="h-8 w-8 shrink-0 rounded-full border" style={{ backgroundColor: m.plantColor.hex }} />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{m.name}</p>
        <p className="text-xs text-muted-foreground">
          {CATEGORY_ICONS[m.category]} {t(`materialCategory.${m.category}`)} · {m.plantColor.colorName}
          {isFoodCategory(m.category) && sanitizeFoodFlavors(m.flavor).length > 0
            ? ` · ${foodFlavorsLabel(t, m.flavor!)}`
            : null}
          {isDrinkCategory(m.category) && m.drinkType ? ` · ${drinkTypeDisplay(t, m.drinkType)}` : null}
          {isDecorCategory(m.category) ? ` · ${decorZoneDisplay(t, m.decorZone ?? "table")}` : null}
          {isMiscCategory(m.category) ? ` · ${miscTypeDisplay(t, resolveMiscType(m))}` : null}
          {m.transactionId ? ` · ${t("loggedToTransactions")}` : null}
        </p>
        {m.characterNote?.trim() ? (
          <p className="mt-1 text-xs text-muted-foreground">{m.characterNote.trim()}</p>
        ) : null}
        {isDecorCategory(m.category) && sanitizeDecorAtmosphere(m.decorAtmosphere).length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {sanitizeDecorAtmosphere(m.decorAtmosphere).slice(0, 4).map((tag) => (
              <span key={tag} className="rounded-full border bg-muted/20 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {decorAtmosphereLabel(t, tag)}
              </span>
            ))}
            {sanitizeDecorAtmosphere(m.decorAtmosphere).length > 4 ? (
              <span className="text-[10px] text-muted-foreground">
                +{sanitizeDecorAtmosphere(m.decorAtmosphere).length - 4}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="text-right text-sm">
        <p className="tabular-nums">
          {m.quantity} × {formatProjectMoney(m.price, currency)} = {formatProjectMoney(m.quantity * m.price, currency)}
        </p>
        <div className="mt-1 flex flex-wrap justify-end gap-2">
          <span className={cn("text-xs", m.transactionId ? "text-emerald-700" : "text-amber-700")}>
            {m.transactionId ? t("purchased") : t("pending")}
          </span>
          {onLogExpense && !m.transactionId ? (
            <button
              type="button"
              disabled={logging}
              className="text-xs text-foreground underline-offset-2 hover:underline disabled:opacity-50"
              onClick={onLogExpense}
            >
              {logging ? t("logExpenseLogging") : t("logExpense")}
            </button>
          ) : null}
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
  loggingMaterialId,
  onAddMaterial,
  onToggleSetup,
  onEditMaterial,
  onDeleteMaterial,
  onLogExpense,
}: {
  party: Party;
  loggingMaterialId?: string | null;
  onAddMaterial: () => void;
  onToggleSetup: (id: string) => void;
  onEditMaterial: (m: Material) => void;
  onDeleteMaterial: (id: string) => void;
  onLogExpense?: (id: string) => void;
}) {
  const t = useTranslations("banquetParty");
  const locale = useLocale();
  const [sub, setSub] = useState<PrepSubTab>("budget");
  const [spinFlower, setSpinFlower] = useState(true);
  const [spinClover, setSpinClover] = useState(true);
  const budget = getPartyBudgetSummary(party);
  const currency = coerceCurrency(party.currency ?? BASE_CURRENCY);
  const gardenPauseLabel = t.has("gardenMotifPause")
    ? t("gardenMotifPause")
    : locale === "zh"
      ? "暂停旋转"
      : "Pause spin";
  const gardenSpinLabel = t.has("gardenMotifSpin")
    ? t("gardenMotifSpin")
    : locale === "zh"
      ? "开始旋转"
      : "Start spin";

  const listMaterials =
    sub === "budget"
      ? []
      : sub === "shopping"
        ? party.materials
        : filterMaterialsForPrep(party.materials, sub);

  return (
    <div className="space-y-4">
      <p className="rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm leading-relaxed text-amber-950/90">
        {t("prepWorkflowHint")}
      </p>
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
        <div className="space-y-3">
          {budget.budgetCap != null && budget.budgetCap > 0 ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                budget.overCap ? "border-amber-300 bg-amber-50 text-amber-950" : "bg-white/80 text-muted-foreground"
              }`}
            >
              <p className="font-medium text-foreground">
                {t("budgetCap")}: {formatProjectMoney(budget.budgetCap, currency)}
                {budget.overCap ? ` · ${t("overCap")}` : ""}
              </p>
              {budget.overCap ? (
                <p className="mt-1 text-xs">
                  {t("overCapDetail", {
                    over: formatProjectMoney(budget.totalPlanned - budget.budgetCap, currency),
                  })}
                </p>
              ) : budget.remaining != null ? (
                <p className="mt-1 text-xs">
                  {t("budgetRemaining", { amount: formatProjectMoney(budget.remaining, currency) })}
                </p>
              ) : null}
            </div>
          ) : null}
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
                  <td className="p-3 tabular-nums">{formatProjectMoney(row.planned, currency)}</td>
                  <td className="p-3 tabular-nums">{formatProjectMoney(row.purchased, currency)}</td>
                  <td className="hidden p-3 text-muted-foreground sm:table-cell">
                    {row.itemCount} · {t("budgetPendingCount", { n: row.pendingCount })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/20 font-medium">
                <td className="p-3">{t("budgetTotal")}</td>
                <td className="p-3 tabular-nums">{formatProjectMoney(budget.totalPlanned, currency)}</td>
                <td className="p-3 tabular-nums">{formatProjectMoney(budget.totalPurchased, currency)}</td>
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
                            currency={currency}
                            logging={loggingMaterialId === m.id}
                            showSetup={false}
                            onLogExpense={onLogExpense ? () => onLogExpense(m.id) : undefined}
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
                        currency={currency}
                        logging={loggingMaterialId === m.id}
                        showSetup={false}
                        onLogExpense={onLogExpense ? () => onLogExpense(m.id) : undefined}
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
      ) : sub === "decor" ? (
        <div className="space-y-4">
          {groupDecorMaterials(party.materials).length === 0 ? (
            <p className="rounded-2xl border bg-white/80 p-6 text-sm text-muted-foreground">{t("noDecorItems")}</p>
          ) : (
            groupDecorMaterials(party.materials).map(({ zone, items }) => (
              <div key={zone} className="overflow-hidden rounded-2xl border bg-white/80">
                <div className="border-b bg-muted/20 px-4 py-2">
                  <p className="text-sm font-medium">{decorZoneDisplay(t, zone)}</p>
                  <p className="text-xs text-muted-foreground">{t("menuCourseCount", { n: items.length })}</p>
                </div>
                <ul className="divide-y">
                  {items.map((m) => (
                    <MaterialRow
                      key={m.id}
                      material={m}
                      currency={currency}
                      logging={loggingMaterialId === m.id}
                      showSetup
                      onToggleSetup={() => onToggleSetup(m.id)}
                      onLogExpense={onLogExpense ? () => onLogExpense(m.id) : undefined}
                      onEdit={() => onEditMaterial(m)}
                      onDelete={() => onDeleteMaterial(m.id)}
                    />
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      ) : sub === "misc" ? (
        <div className="space-y-4">
          {groupMiscMaterials(party.materials).length === 0 ? (
            <p className="rounded-2xl border bg-white/80 p-6 text-sm text-muted-foreground">{t("noMiscItems")}</p>
          ) : (
            groupMiscMaterials(party.materials).map(({ miscType, items }) => (
              <div key={miscType} className="overflow-hidden rounded-2xl border bg-white/80">
                <div className="border-b bg-muted/20 px-4 py-2">
                  <p className="text-sm font-medium">{miscTypeDisplay(t, miscType)}</p>
                  <p className="text-xs text-muted-foreground">{miscTypeHintText(locale, miscType)}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground/80">{t("menuCourseCount", { n: items.length })}</p>
                </div>
                <ul className="divide-y">
                  {items.map((m) => (
                    <MaterialRow
                      key={m.id}
                      material={m}
                      currency={currency}
                      logging={loggingMaterialId === m.id}
                      showSetup={false}
                      onLogExpense={onLogExpense ? () => onLogExpense(m.id) : undefined}
                      onEdit={() => onEditMaterial(m)}
                      onDelete={() => onDeleteMaterial(m.id)}
                    />
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="rounded-2xl border bg-white/80">
          {listMaterials.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("noMaterials")}</p>
          ) : (
            <ul className="divide-y">
              {listMaterials.map((m) => (
                <MaterialRow
                  key={m.id}
                  material={m}
                  currency={currency}
                  logging={loggingMaterialId === m.id}
                  showSetup={false}
                  onLogExpense={onLogExpense ? () => onLogExpense(m.id) : undefined}
                  onEdit={() => onEditMaterial(m)}
                  onDelete={() => onDeleteMaterial(m.id)}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="relative isolate mx-auto w-full max-w-sm px-7 py-6">
        {/* 植物色小花苞：贴在框外一圈，不压边框 */}
        <span
          aria-hidden
          className="pointer-events-none absolute right-5 top-1.5 h-2 w-2 rounded-full opacity-90"
          style={{ background: "radial-gradient(circle at 30% 30%, #E8C84A, #E8A853)" }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-1.5 left-8 h-2 w-2 rounded-full opacity-85"
          style={{ background: "radial-gradient(circle at 30% 30%, #B8C8A8, #6B9B6B)" }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-1 right-12 h-1.5 w-1.5 rounded-full opacity-70 blur-[0.5px]"
          style={{ background: "radial-gradient(circle at 35% 30%, #D4C0D0, #8B6B8B)" }}
        />
        {/* 青色上、橙色下：偏一侧，避开中心线 */}
        <span
          aria-hidden
          className="pointer-events-none absolute right-10 top-1 h-2.5 w-2.5 rounded-full opacity-90"
          style={{ background: "radial-gradient(circle at 30% 30%, #A8E6E0, #2BB8A8)" }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute left-10 bottom-1 h-2.5 w-2.5 rounded-full opacity-90"
          style={{ background: "radial-gradient(circle at 30% 30%, #F0C080, #E87A3A)" }}
        />

        {/* 小花 · 左侧 · 可转 */}
        <button
          type="button"
          aria-pressed={spinFlower}
          aria-label={spinFlower ? gardenPauseLabel : gardenSpinLabel}
          title={spinFlower ? gardenPauseLabel : gardenSpinLabel}
          className="absolute -left-1.5 top-1/2 z-10 flex min-h-9 min-w-9 -translate-y-1/2 items-center justify-center rounded-full"
          onClick={() => setSpinFlower((v) => !v)}
        >
          <svg
            viewBox="0 0 24 24"
            className={cn(
              "h-[18px] w-[18px] drop-shadow-[0_0_3px_rgba(232,93,117,0.45)]",
              spinFlower && "animate-[spin_8s_linear_infinite] motion-reduce:animate-none",
            )}
          >
            <circle cx="12" cy="12" r="2.2" fill="#E8A853" />
            <ellipse cx="12" cy="5.2" rx="2.4" ry="3.6" fill="#E85D75" opacity="0.95" />
            <ellipse cx="12" cy="18.8" rx="2.4" ry="3.6" fill="#E85D75" opacity="0.9" />
            <ellipse cx="5.2" cy="12" rx="3.6" ry="2.4" fill="#F0D5D0" opacity="0.95" />
            <ellipse cx="18.8" cy="12" rx="3.6" ry="2.4" fill="#D4C0D0" opacity="0.95" />
            <ellipse cx="7.2" cy="7.2" rx="2.2" ry="3.2" fill="#E85D75" opacity="0.75" transform="rotate(-40 7.2 7.2)" />
            <ellipse cx="16.8" cy="7.2" rx="2.2" ry="3.2" fill="#F0D5D0" opacity="0.8" transform="rotate(40 16.8 7.2)" />
          </svg>
        </button>

        {/* 四叶草 · 右侧（与叶片互换）· 可转 */}
        <button
          type="button"
          aria-pressed={spinClover}
          aria-label={spinClover ? gardenPauseLabel : gardenSpinLabel}
          title={spinClover ? gardenPauseLabel : gardenSpinLabel}
          className="absolute -right-1.5 top-1/2 z-10 flex min-h-9 min-w-9 -translate-y-1/2 items-center justify-center rounded-full"
          onClick={() => setSpinClover((v) => !v)}
        >
          <svg
            viewBox="0 0 24 24"
            className={cn(
              "h-[17px] w-[17px] drop-shadow-[0_0_4px_rgba(37,99,235,0.65)]",
              spinClover && "animate-[spin_9s_linear_infinite] motion-reduce:animate-none",
            )}
          >
            <defs>
              <linearGradient id="sapphireCloverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#bfdbfe" />
                <stop offset="40%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
            </defs>
            <ellipse cx="12" cy="6.2" rx="3.1" ry="4.2" fill="url(#sapphireCloverGrad)" />
            <ellipse cx="12" cy="17.8" rx="3.1" ry="4.2" fill="url(#sapphireCloverGrad)" opacity="0.95" />
            <ellipse cx="6.2" cy="12" rx="4.2" ry="3.1" fill="url(#sapphireCloverGrad)" opacity="0.92" />
            <ellipse cx="17.8" cy="12" rx="4.2" ry="3.1" fill="url(#sapphireCloverGrad)" opacity="0.92" />
            <circle cx="12" cy="12" r="1.6" fill="#93c5fd" />
            <circle cx="11.4" cy="5.2" r="0.55" fill="#fff" fillOpacity="0.85" />
            <path d="M12 14.5V21" stroke="#1e40af" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>

        {/* 叶片 · 左上（与四叶草互换）· 静态 */}
        <span aria-hidden className="pointer-events-none absolute left-4 top-0 z-10">
          <svg viewBox="0 0 24 24" className="h-[16px] w-[16px] -rotate-[22deg] drop-shadow-[0_0_3px_rgba(107,155,107,0.5)]">
            <defs>
              <linearGradient id="gardenLeafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#B8C8A8" />
                <stop offset="45%" stopColor="#6B9B6B" />
                <stop offset="100%" stopColor="#5B7B5B" />
              </linearGradient>
            </defs>
            <path
              d="M12 21C12 21 4.5 15.5 4.5 9.5C4.5 6.5 7 3.5 12 2.5C17 3.5 19.5 6.5 19.5 9.5C19.5 15.5 12 21 12 21Z"
              fill="url(#gardenLeafGrad)"
            />
            <path d="M12 21V5.5" stroke="#5B7B5B" strokeWidth="1.1" strokeLinecap="round" fill="none" />
            <path d="M12 10C9.5 9.2 7.8 8.2 6.8 7" stroke="#6B9B6B" strokeWidth="0.8" strokeLinecap="round" fill="none" opacity="0.7" />
            <path d="M12 13C14.2 12.1 16 11 17 9.8" stroke="#8BB88B" strokeWidth="0.8" strokeLinecap="round" fill="none" opacity="0.7" />
          </svg>
        </span>

        {/* 小葫芦 · 右下 · 静态 */}
        <span aria-hidden className="pointer-events-none absolute bottom-0 right-3 z-10">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] rotate-[12deg] drop-shadow-[0_0_4px_rgba(232,168,83,0.65)]">
            <defs>
              <linearGradient id="goldenGourdGrad" x1="20%" y1="0%" x2="80%" y2="100%">
                <stop offset="0%" stopColor="#F5E6A3" />
                <stop offset="35%" stopColor="#E8C84A" />
                <stop offset="70%" stopColor="#E8A853" />
                <stop offset="100%" stopColor="#D4A030" />
              </linearGradient>
            </defs>
            {/* 俏皮弯柄：轻微开口弧，不成圈 */}
            <path
              d="M12 5.6 C11.6 3.2 13 0.9 15.2 0.7"
              stroke="#6B9B6B"
              strokeWidth="1.35"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="15.2" cy="0.7" r="0.6" fill="#8BB88B" />
            <ellipse cx="12" cy="8" rx="3.2" ry="3.5" fill="url(#goldenGourdGrad)" />
            <ellipse cx="12" cy="16.2" rx="5.1" ry="5.3" fill="url(#goldenGourdGrad)" />
            <ellipse cx="12" cy="11.6" rx="2.3" ry="1" fill="#D4A030" opacity="0.55" />
            <ellipse cx="10.3" cy="7" rx="0.65" ry="1" fill="#fff" fillOpacity="0.45" />
            <ellipse cx="9.6" cy="14.6" rx="1" ry="1.5" fill="#fff" fillOpacity="0.28" />
          </svg>
        </span>

        <button
          type="button"
          className="relative z-0 w-full rounded-full border border-transparent py-2.5 text-sm text-[#6B5B4F] shadow-[0_0_0_2px_rgba(232,168,83,0.25),0_0_10px_rgba(139,184,139,0.2)] [background:linear-gradient(#fff,#fff)_padding-box,linear-gradient(135deg,#F0D5D0,#E85D75,#E8A853,#8BB88B,#8BB8D4,#D4C0D0,#F0D5D0)_border-box] hover:brightness-[0.99]"
          onClick={onAddMaterial}
        >
          + {t("addMaterial")}
        </button>
      </div>
    </div>
  );
}
