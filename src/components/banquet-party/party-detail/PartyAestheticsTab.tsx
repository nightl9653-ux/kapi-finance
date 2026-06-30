"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { ColorCarousel, ColorComposition } from "@/components/banquet-party/ColorCarousel";
import { filterCarouselImages } from "@/lib/banquet-party/carousel";
import { getSoulCharacter } from "@/lib/banquet-party/characters";
import type { Party } from "@/lib/banquet-party/types";

export function PartyAestheticsTab({ party }: { party: Party }) {
  const t = useTranslations("banquetParty");
  const [filterPlantId, setFilterPlantId] = useState<string | null>(null);
  const character = getSoulCharacter(party.characterId);
  const images = useMemo(() => filterCarouselImages(party, filterPlantId), [party, filterPlantId]);
  const palette = party.colorPalette;

  return (
    <div className="space-y-6">
      {character ? (
        <div className="rounded-2xl border bg-gradient-to-br from-[#F4EFEA] via-[#FAF9F7] to-[#EEE7DE] p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("soulCharacter")}</p>
          <p className="mt-1 text-lg font-semibold">
            {character.emoji} {t(`characters.${character.nameKey}`)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{t(`characters.${character.styleKey}`)}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("jewelryStyle")}: {t(`characters.${character.jewelryKey}`)}
          </p>
        </div>
      ) : null}

      <ColorCarousel
        images={images}
        filterPlantId={filterPlantId}
        onFilterChange={setFilterPlantId}
        materials={party.materials}
      />

      <div className="rounded-2xl border bg-white/80 p-4">
        <ColorComposition
          distribution={palette.distribution}
          primary={palette.primary}
          secondaries={palette.secondaries}
          accents={palette.accents}
        />
      </div>
    </div>
  );
}
