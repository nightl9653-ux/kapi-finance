"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CATEGORY_CUSTOM,
  EXPENSE_CATEGORY_KEYS,
  formatCategoryLabel,
  INCOME_CATEGORY_KEYS,
  parseCategoryUiState,
} from "@/lib/transaction-categories";

function keysForType(ty: "expense" | "income") {
  return ty === "income" ? INCOME_CATEGORY_KEYS : EXPENSE_CATEGORY_KEYS;
}

function labelForKey(t: (k: string) => string, ty: "expense" | "income", key: string): string {
  return formatCategoryLabel(key, ty, t);
}

export function TransactionCategoryFields({
  typeSelectId,
  defaultType = "expense",
  defaultCategory = "",
  categoryCustomId,
}: {
  typeSelectId: string;
  defaultType?: "expense" | "income";
  defaultCategory?: string;
  /** 与类型下拉 id 区分，避免页内多表单时重复 id */
  categoryCustomId?: string;
}) {
  const t = useTranslations("transactions");
  const common = useTranslations("common");
  const initialType = useMemo(() => defaultType, [defaultType]);
  const [type, setType] = useState<"expense" | "income">(initialType);

  const initialUi = useMemo(() => parseCategoryUiState(defaultCategory, initialType), [defaultCategory, initialType]);
  const [preset, setPreset] = useState(initialUi.preset);
  const [custom, setCustom] = useState(initialUi.custom);

  useEffect(() => {
    const el = document.getElementById(typeSelectId) as HTMLSelectElement | null;
    if (!el) return;

    const read = () => {
      const next = el.value === "income" ? "income" : "expense";
      setType(next);
      setPreset((prev) => {
        const allowed = keysForType(next);
        if ((allowed as readonly string[]).includes(prev) || prev === CATEGORY_CUSTOM) {
          if (prev === CATEGORY_CUSTOM) return prev;
          return prev;
        }
        return allowed[0];
      });
    };

    read();
    el.addEventListener("change", read);
    return () => el.removeEventListener("change", read);
  }, [typeSelectId]);

  const keys = keysForType(type);
  const customId = categoryCustomId ?? `${typeSelectId}-category-custom`;

  return (
    <div className="space-y-2">
      <input type="hidden" name="category_preset" value={preset} />
      <input type="hidden" name="category_custom" value={preset === CATEGORY_CUSTOM ? custom : ""} />

      <Label htmlFor={`${typeSelectId}-category-preset`}>{t("category")}</Label>
      <select
        id={`${typeSelectId}-category-preset`}
        value={preset}
        onChange={(e) => {
          const v = e.target.value;
          setPreset(v);
          if (v !== CATEGORY_CUSTOM) setCustom("");
        }}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {keys.map((k) => (
          <option key={k} value={k}>
            {labelForKey(t, type, k)}
          </option>
        ))}
        <option value={CATEGORY_CUSTOM}>{t("categoryCustom")}</option>
      </select>

      {preset === CATEGORY_CUSTOM ? (
        <div className="space-y-2">
          <Label htmlFor={customId}>
            {t("categoryCustomDetail")}
            <span className="ml-1 text-[11px] text-sky-700/70">{common("requiredInParens")}</span>
          </Label>
          <Input
            id={customId}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder={t("categoryCustomPlaceholder")}
            required
            autoComplete="off"
          />
        </div>
      ) : null}
    </div>
  );
}
