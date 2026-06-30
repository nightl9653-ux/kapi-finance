import type { CarouselImage, Material, Party, Plant } from "@/lib/banquet-party/types";
import { calculateColorPalette } from "@/lib/banquet-party/palette";
import { getPlant } from "@/lib/banquet-party/plants";

/** Unsplash 免费图库占位；找到满意图片后把 url 换成本地路径如 /banquet-party/xxx.jpg */
const photo = (id: string) =>
  `https://images.unsplash.com/${id}?w=800&q=80&auto=format&fit=crop`;

export const SEED_IMAGES: CarouselImage[] = [
  {
    id: "img_golden_dinner",
    url: photo("photo-1414235077428-338989a2e8c0"),
    gradient: "linear-gradient(135deg, #E8A853 0%, #D4A030 45%, #8B6B8B 100%)",
    source: "magazine",
    sourceName: "Architectural Digest",
    plantIds: ["rudbeckia", "helenium", "aster_twilight"],
    dominantPlantId: "rudbeckia",
    tags: ["golden-hour", "formal-dinner"],
    type: "party",
  },
  {
    id: "img_rudbeckia_meadow",
    url: photo("photo-1490750967868-88aa4486c946"),
    gradient: "linear-gradient(160deg, #E8C84A 0%, #E8A853 50%, #6B9B6B 100%)",
    source: "garden",
    sourceName: "Piet Oudolf — The High Line",
    plantIds: ["rudbeckia", "aster_twilight", "echinops"],
    dominantPlantId: "rudbeckia",
    tags: ["wild-meadow", "golden", "autumn"],
    type: "garden",
  },
  {
    id: "img_purple_twilight",
    url: photo("photo-1519225421834-359513329a56"),
    gradient: "linear-gradient(145deg, #8B6B8B 0%, #7B8DB8 40%, #F0D5D0 100%)",
    source: "magazine",
    sourceName: "Kinfolk",
    plantIds: ["aster_twilight", "scabiosa", "achillea_filipendulina"],
    dominantPlantId: "aster_twilight",
    tags: ["twilight", "romantic"],
    type: "party",
  },
  {
    id: "img_verbena_field",
    url: photo("photo-1416879595882-3373b129bad9"),
    gradient: "linear-gradient(120deg, #D4C0D0 0%, #8BB8D4 55%, #B8C8A8 100%)",
    source: "garden",
    sourceName: "Great Dixter",
    plantIds: ["verbena_bonariensis", "salvia_uliginosa", "nassella_tenuissima"],
    dominantPlantId: "verbena_bonariensis",
    tags: ["wild-meadow", "summer"],
    type: "garden",
  },
  {
    id: "img_white_minimal",
    url: photo("photo-1464366400600-7168b8af9bc3"),
    gradient: "linear-gradient(180deg, #F5F3F0 0%, #E8E5DF 50%, #C8C0B8 100%)",
    source: "magazine",
    sourceName: "Cereal",
    plantIds: ["veronicastrum_album", "briza_maxima", "jacobaea_maritima"],
    dominantPlantId: "veronicastrum_album",
    tags: ["minimal", "daylight"],
    type: "party",
  },
  {
    id: "img_red_accent",
    url: photo("photo-1519167758481-83f550bb49b8"),
    gradient: "linear-gradient(135deg, #E03C31 0%, #C41E3A 35%, #3D1F2E 100%)",
    source: "movie",
    sourceName: "Hollywood Regency",
    plantIds: ["papaver_rhoeas", "lychnis_coronaria", "prunus_nigra"],
    dominantPlantId: "papaver_rhoeas",
    tags: ["dramatic", "evening"],
    type: "party",
  },
  {
    id: "img_green_base",
    url: photo("photo-1585320806297-9794b1702892"),
    gradient: "linear-gradient(160deg, #6B9B6B 0%, #8BB88B 40%, #B8886B 100%)",
    source: "garden",
    sourceName: "Wild Garden",
    plantIds: ["thalictrum", "aruncus", "pennisetum"],
    dominantPlantId: "thalictrum",
    tags: ["natural", "base-greens"],
    type: "garden",
  },
  {
    id: "img_blue_steel",
    url: photo("photo-1555244162-803834f70033"),
    gradient: "linear-gradient(145deg, #6B8B9B 0%, #7B8DB8 50%, #F5F0E8 100%)",
    source: "magazine",
    sourceName: "Wallpaper*",
    plantIds: ["echinops", "scabiosa", "aquilegia_alba"],
    dominantPlantId: "echinops",
    tags: ["cool-tone", "structured"],
    type: "party",
  },
  {
    id: "img_orange_sunset",
    url: photo("photo-1508784085062-ca2dab19cfe3"),
    gradient: "linear-gradient(135deg, #E87A3A 0%, #D4883A 45%, #E86A33 100%)",
    source: "garden",
    sourceName: "Meadow Sunset",
    plantIds: ["aquilegia_orange", "solidago_goldenmosa", "kniphofia_uvaria"],
    dominantPlantId: "solidago_goldenmosa",
    tags: ["sunset", "warm"],
    type: "garden",
  },
  {
    id: "img_pink_soft",
    url: photo("photo-1530103862676-de8c9debad1d"),
    gradient: "linear-gradient(150deg, #F0D5D0 0%, #E8C8B8 50%, #E85D75 100%)",
    source: "magazine",
    sourceName: "Vogue Living",
    plantIds: ["achillea_filipendulina", "cortaderia_pumila", "lycoris_radiata"],
    dominantPlantId: "achillea_filipendulina",
    tags: ["soft", "garden-party"],
    type: "party",
  },
  {
    id: "img_jewelry_pearl",
    url: photo("photo-1515562141207-29a4b74faa64"),
    gradient: "linear-gradient(135deg, #F5F0E8 0%, #E8E5DF 50%, #D4C0D0 100%)",
    source: "magazine",
    sourceName: "Harper's Bazaar",
    plantIds: ["briza_maxima", "echinacea_pallida", "achillea_filipendulina"],
    dominantPlantId: "briza_maxima",
    tags: ["pearl", "editorial"],
    type: "jewelry",
  },
  {
    id: "img_jewelry_gold",
    url: photo("photo-1605100804763-247fe67cf681"),
    gradient: "linear-gradient(135deg, #E8A853 0%, #D4A030 50%, #B8886B 100%)",
    source: "magazine",
    sourceName: "Vanity Fair",
    plantIds: ["rudbeckia", "helenium", "solidago_goldenmosa"],
    dominantPlantId: "rudbeckia",
    tags: ["gold", "glamour"],
    type: "jewelry",
  },
  {
    id: "img_jewelry_diamond",
    url: photo("photo-1611591437281-460bfac51483"),
    gradient: "linear-gradient(135deg, #F5F3F0 0%, #C8C0B8 50%, #7B8DB8 100%)",
    source: "movie",
    sourceName: "Old Hollywood",
    plantIds: ["veronicastrum_album", "scabiosa", "prunus_nigra"],
    dominantPlantId: "veronicastrum_album",
    tags: ["diamond", "evening"],
    type: "jewelry",
  },
];

function interleave(groups: CarouselImage[][]): CarouselImage[] {
  const result: CarouselImage[] = [];
  const seen = new Set<string>();
  const maxLen = Math.max(...groups.map((g) => g.length), 0);
  for (let round = 0; round < maxLen && result.length < 12; round++) {
    for (const group of groups) {
      const img = group[round];
      if (img && !seen.has(img.id)) {
        seen.add(img.id);
        result.push(img);
        if (result.length >= 12) break;
      }
    }
  }
  return result;
}

function getImagesByPlant(plantId: string, plant: Plant | undefined): CarouselImage[] {
  const hex = plant?.hex ?? "#888";
  const matched = SEED_IMAGES.filter((img) => img.plantIds.includes(plantId)).sort((a, b) => {
    if (a.dominantPlantId === plantId && b.dominantPlantId !== plantId) return -1;
    if (a.dominantPlantId !== plantId && b.dominantPlantId === plantId) return 1;
    return 0;
  });
  if (matched.length > 0) return matched;
  return [
    {
      id: `fallback_${plantId}_party`,
      url: "",
      gradient: `linear-gradient(135deg, ${hex} 0%, ${hex}88 100%)`,
      source: "garden",
      sourceName: "Wild palette",
      plantIds: [plantId],
      dominantPlantId: plantId,
      tags: ["generated"],
      type: "party",
    },
  ];
}

function defaultCarouselImages(): CarouselImage[] {
  return interleave([
    SEED_IMAGES.filter((img) => img.type === "party").slice(0, 4),
    SEED_IMAGES.filter((img) => img.type === "garden").slice(0, 4),
    SEED_IMAGES.filter((img) => img.type === "jewelry"),
  ]);
}

export function filterCarouselImages(party: Party, filterPlantId?: string | null): CarouselImage[] {
  const usedPlantIds = [...new Set(party.materials.map((m) => m.plantColor.id))];

  if (filterPlantId) {
    return SEED_IMAGES.filter((img) => img.plantIds.includes(filterPlantId)).sort((a, b) => {
      if (a.dominantPlantId === filterPlantId && b.dominantPlantId !== filterPlantId) return -1;
      if (a.dominantPlantId !== filterPlantId && b.dominantPlantId === filterPlantId) return 1;
      return 0;
    });
  }

  if (party.materials.length === 0) {
    return defaultCarouselImages();
  }

  const palette = calculateColorPalette(party.materials);
  const primaryId = palette.primary?.id;
  const secondaryIds = palette.secondaries.map((p) => p.id);
  const accentIds = palette.accents.map((p) => p.id);

  const primaryImages = primaryId ? getImagesByPlant(primaryId, palette.primary!).slice(0, 6) : [];
  const secondaryImages = secondaryIds.flatMap((id) => getImagesByPlant(id, getPlant(id)).slice(0, 2));
  const accentImages = accentIds.flatMap((id) =>
    getImagesByPlant(id, getPlant(id))
      .filter((img) => img.type === "garden")
      .slice(0, 1),
  );
  const jewelryImages = SEED_IMAGES.filter((img) => img.type === "jewelry");

  const mixed = interleave([primaryImages, secondaryImages, accentImages, jewelryImages]);
  if (mixed.length > 0) return mixed;

  return SEED_IMAGES.filter((img) => usedPlantIds.some((id) => img.plantIds.includes(id)));
}

export type ColorCardState = "active" | "inactive" | "present";

export function getColorCardState(
  plantId: string,
  filterPlantId: string | null,
  materials: Material[],
): ColorCardState {
  if (filterPlantId === plantId) return "active";
  if (materials.some((m) => m.plantColor.id === plantId)) return "present";
  return "inactive";
}
