"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { PLANT_CATEGORY_ORDER, getPlantsByCategory } from "@/lib/banquet-party/plants";
import { getPaletteReasonKey, recommendPalette } from "@/lib/banquet-party/palette";
import type { Plant } from "@/lib/banquet-party/types";
import { cn } from "@/lib/utils";

export function PlantColorPicker({
  value,
  onChange,
  onRecommendAccept,
}: {
  value: Plant | null;
  onChange: (plant: Plant) => void;
  onRecommendAccept?: (plants: Plant[]) => void;
}) {
  const t = useTranslations("banquetParty");
  const [selected, setSelected] = useState<Plant | null>(value);
  const [recommendations, setRecommendations] = useState<Plant[]>([]);
  const [showRec, setShowRec] = useState(false);

  const grouped = useMemo(
    () => PLANT_CATEGORY_ORDER.map((cat) => ({ cat, plants: getPlantsByCategory(cat) })),
    [],
  );

  const pick = (plant: Plant) => {
    setSelected(plant);
    onChange(plant);
    const rec = recommendPalette(plant);
    setRecommendations(rec);
    setShowRec(true);
  };

  const reasonKey = selected && recommendations.length > 0 ? getPaletteReasonKey(selected, recommendations) : null;

  return (
    <div className="space-y-4">
      {grouped.map(({ cat, plants }) => (
        <div key={cat}>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t(`plantCategory.${cat}`)}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {plants.map((plant) => (
              <button
                key={plant.id}
                type="button"
                onClick={() => pick(plant)}
                className={cn(
                  "flex items-start gap-2 rounded-xl border p-2 text-left transition-colors",
                  selected?.id === plant.id ? "border-foreground/40 bg-muted/30 ring-1 ring-foreground/20" : "hover:bg-muted/20",
                )}
              >
                <span
                  className="mt-0.5 h-8 w-8 shrink-0 rounded-full border border-black/10 shadow-inner"
                  style={{ backgroundColor: plant.hex }}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium">{plant.name}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">{plant.colorName}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {showRec && selected && recommendations.length > 0 ? (
        <div className="rounded-2xl border border-amber-200/60 bg-gradient-to-br from-[#FBF7F0] to-[#F4EFEA] p-4">
          <p className="text-sm font-medium">{t("paletteRecommendTitle")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("paletteRecommendLead", { name: selected.name })}</p>
          {reasonKey ? <p className="mt-2 text-xs text-amber-900/80">{t(`paletteReason.${reasonKey}`)}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {recommendations.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 rounded-full border bg-white/80 px-2 py-1 text-xs"
              >
                <span className="h-4 w-4 rounded-full border" style={{ backgroundColor: p.hex }} />
                {p.name}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {onRecommendAccept ? (
              <Button type="button" size="sm" className="rounded-full" onClick={() => onRecommendAccept(recommendations)}>
                {t("acceptRecommend")}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => setRecommendations(recommendPalette(selected, recommendations.map((r) => r.id)))}
            >
              {t("shuffleRecommend")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
