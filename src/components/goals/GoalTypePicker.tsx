"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const GOAL_TYPES = [
  { key: "housing", emoji: "🏠" },
  { key: "travel", emoji: "✈️" },
  { key: "retirement", emoji: "🌴" },
  { key: "emergency", emoji: "🛡️" },
  { key: "education", emoji: "🎓" },
  { key: "car", emoji: "🚗" },
  { key: "debt", emoji: "💳" },
  { key: "medical", emoji: "🏥" },
] as const;

function isPresetType(type: string): boolean {
  return GOAL_TYPES.some((x) => x.key === type);
}

export function GoalTypePicker({
  typeName = "type",
  customName = "type_custom",
  defaultType,
}: {
  typeName?: string;
  customName?: string;
  defaultType?: string;
}) {
  const t = useTranslations("goals");

  const initial = useMemo(() => {
    const raw = String(defaultType ?? "").trim();
    if (raw && isPresetType(raw)) return { selected: raw, custom: "" };
    if (raw) return { selected: "custom", custom: raw };
    return { selected: "housing", custom: "" };
  }, [defaultType]);

  const [selected, setSelected] = useState<string>(initial.selected);
  const [custom, setCustom] = useState<string>(initial.custom);
  const customEnabled = selected === "custom";

  return (
    <div className="space-y-2 sm:col-span-2">
      <div className="flex items-center justify-between gap-2">
        <Label>{t("type")}</Label>
        <span className="text-xs text-muted-foreground">{t("typeHint")}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {GOAL_TYPES.map((gt) => (
          <label
            key={gt.key}
            className="group relative flex cursor-pointer items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm hover:bg-muted/30 has-[:checked]:border-foreground/30 has-[:checked]:bg-muted/20"
          >
            <input
              type="radio"
              name={typeName}
              value={gt.key}
              className="sr-only"
              checked={selected === gt.key}
              onChange={() => setSelected(gt.key)}
            />
            <span className="text-base">{gt.emoji}</span>
            <span className="truncate">{t(gt.key)}</span>
          </label>
        ))}

        <label className="group relative flex cursor-pointer items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm hover:bg-muted/30 has-[:checked]:border-foreground/30 has-[:checked]:bg-muted/20">
          <input
            type="radio"
            name={typeName}
            value="custom"
            className="sr-only"
            checked={customEnabled}
            onChange={() => setSelected("custom")}
          />
          <span className="text-base">✨</span>
          <span className="truncate">{t("customType")}</span>
        </label>
      </div>

      <Input
        name={customName}
        placeholder={t("customTypePlaceholder")}
        value={custom}
        onChange={(e) => setCustom(e.target.value)}
        disabled={!customEnabled}
        required={customEnabled}
        aria-label={t("customType")}
      />

      {!customEnabled ? (
        <div className="text-xs text-muted-foreground">{t("customTypeDisabledHint")}</div>
      ) : null}
    </div>
  );
}

