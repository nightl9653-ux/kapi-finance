"use client";

import { useTranslations } from "next-intl";

import type { CarouselImage, Material } from "@/lib/banquet-party/types";
import { getColorCardState } from "@/lib/banquet-party/carousel";
import { getPlant } from "@/lib/banquet-party/plants";
import { cn } from "@/lib/utils";

export function ColorCarousel({
  images,
  filterPlantId,
  onFilterChange,
  materials,
}: {
  images: CarouselImage[];
  filterPlantId: string | null;
  onFilterChange: (plantId: string | null) => void;
  materials: Material[];
}) {
  const t = useTranslations("banquetParty");

  const usedPlants = [...new Map(materials.map((m) => [m.plantColor.id, m.plantColor])).values()];

  const imageTypeLabel = (type: CarouselImage["type"]) => {
    if (type === "party") return t("imageTypeParty");
    if (type === "garden") return t("imageTypeGarden");
    return t("imageTypeJewelry");
  };

  const cardBackground = (img: CarouselImage): React.CSSProperties =>
    img.url
      ? {
          backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.45), rgba(0,0,0,0.05)), url("${img.url}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : { background: img.gradient ?? "#888" };

  return (
    <div className="space-y-3">
      <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {images.map((img) => (
          <figure
            key={img.id}
            className="relative h-44 w-64 shrink-0 overflow-hidden rounded-2xl border shadow-sm"
            style={cardBackground(img)}
          >
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-3 text-white">
              <p className="text-xs font-medium">{img.sourceName}</p>
              <p className="text-[10px] opacity-90">
                {imageTypeLabel(img.type)} · {img.tags[0]}
              </p>
            </figcaption>
          </figure>
        ))}
      </div>

      {usedPlants.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("colorCardsLabel")}</span>
          {usedPlants.map((plant) => {
            const state = getColorCardState(plant.id, filterPlantId, materials);
            return (
              <button
                key={plant.id}
                type="button"
                title={plant.name}
                onClick={() => onFilterChange(filterPlantId === plant.id ? null : plant.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-all",
                  state === "active" && "border-foreground ring-2 ring-foreground/20",
                  state === "present" && "border-amber-300/80 bg-amber-50/50",
                  state === "inactive" && "opacity-60",
                )}
              >
                <span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: plant.hex }} />
                {plant.colorName}
              </button>
            );
          })}
          {filterPlantId ? (
            <button type="button" className="text-xs text-muted-foreground underline" onClick={() => onFilterChange(null)}>
              {t("clearFilter")}
            </button>
          ) : null}
        </div>
      ) : null}

      {materials.length === 0 && images.length > 0 ? (
        <p className="text-xs text-muted-foreground">{t("carouselHint")}</p>
      ) : null}
    </div>
  );
}

export function ColorComposition({
  distribution,
  primary,
  secondaries,
  accents,
}: {
  distribution: { plantId: string; percentage: number }[];
  primary: ReturnType<typeof getPlant> | null;
  secondaries: NonNullable<ReturnType<typeof getPlant>>[];
  accents: NonNullable<ReturnType<typeof getPlant>>[];
}) {
  const t = useTranslations("banquetParty");

  if (distribution.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noColorsYet")}</p>;
  }

  const secondaryPct = secondaries.reduce((sum, p) => {
    const d = distribution.find((x) => x.plantId === p.id);
    return sum + (d?.percentage ?? 0);
  }, 0);
  const accentPct = accents.reduce((sum, p) => {
    const d = distribution.find((x) => x.plantId === p.id);
    return sum + (d?.percentage ?? 0);
  }, 0);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {distribution.map(({ plantId, percentage }) => {
          const plant = getPlant(plantId);
          if (!plant) return null;
          const isPrimary = primary?.id === plantId;
          return (
            <div
              key={plantId}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3",
                isPrimary && "border-amber-400/50 bg-amber-50/40",
              )}
            >
              <span className="h-10 w-10 shrink-0 rounded-full border" style={{ backgroundColor: plant.hex }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {plant.name}
                  {isPrimary ? <span className="ml-2 text-xs text-amber-800">{t("rolePrimary")}</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {plant.colorName} · {plant.hex}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums">{percentage}%</span>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border bg-[#FAF9F7] p-4 text-sm">
        <p className="font-medium">{t("paletteSummary")}</p>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {primary ? (
            <li>
              {t("summaryPrimary", {
                name: primary.name,
                pct: distribution.find((d) => d.plantId === primary.id)?.percentage ?? 0,
              })}
            </li>
          ) : null}
          {secondaries.length > 0 ? (
            <li>{t("summarySecondaries", { names: secondaries.map((p) => p.name).join("、"), pct: secondaryPct })}</li>
          ) : null}
          {accents.length > 0 ? (
            <li>{t("summaryAccents", { names: accents.map((p) => p.name).join("、"), pct: accentPct })}</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
