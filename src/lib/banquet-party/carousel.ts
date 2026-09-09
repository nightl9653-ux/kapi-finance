import type { CarouselImage, Material, Party, Plant } from "@/lib/banquet-party/types";
import { calculateColorPalette } from "@/lib/banquet-party/palette";
import { getPlant } from "@/lib/banquet-party/plants";

const photo = (file: string) => `/banquet-party/${file}`;

export const SEED_IMAGES: CarouselImage[] = [
  {
    id: "img_golden_dinner",
    url: photo("golden-dinner.webp"),
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
    url: photo("rudbeckia-meadow.webp"),
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
    url: photo("purple-twilight.webp"),
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
    url: photo("verbena-field.webp"),
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
    url: photo("white-minimal.webp"),
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
    url: photo("red-accent.webp"),
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
    url: photo("green-base.webp"),
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
    url: photo("blue-steel.webp"),
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
    url: photo("orange-sunset.webp"),
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
    url: photo("pink-soft.webp"),
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
    url: photo("jewelry-pearl.webp"),
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
    url: photo("jewelry-gold.webp"),
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
    url: photo("jewelry-diamond.webp"),
    gradient: "linear-gradient(135deg, #F5F3F0 0%, #C8C0B8 50%, #7B8DB8 100%)",
    source: "movie",
    sourceName: "Old Hollywood",
    plantIds: ["veronicastrum_album", "scabiosa", "prunus_nigra"],
    dominantPlantId: "veronicastrum_album",
    tags: ["diamond", "evening"],
    type: "jewelry",
  },
  {
    id: "img_party_sage",
    url: photo("party-sage.webp"),
    gradient: "linear-gradient(145deg, #8BB88B 0%, #6B9B6B 50%, #F5F3F0 100%)",
    source: "magazine",
    sourceName: "Cabana",
    plantIds: ["thalictrum", "aruncus", "miscanthus_sinensis"],
    dominantPlantId: "aruncus",
    tags: ["sage", "daylight"],
    type: "party",
  },
  {
    id: "img_party_citrus",
    url: photo("party-citrus.webp"),
    gradient: "linear-gradient(135deg, #E87A3A 0%, #D4883A 45%, #E8A853 100%)",
    source: "magazine",
    sourceName: "Martha Stewart Living",
    plantIds: ["solidago_goldenmosa", "aquilegia_orange", "coreopsis_verticillata"],
    dominantPlantId: "aquilegia_orange",
    tags: ["citrus", "warm"],
    type: "party",
  },
  {
    id: "img_party_noir",
    url: photo("party-noir.webp"),
    gradient: "linear-gradient(160deg, #3D1F2E 0%, #4A2A3A 50%, #5C2E2E 100%)",
    source: "movie",
    sourceName: "Noir Soirée",
    plantIds: ["prunus_nigra", "aquilegia_atrata", "aster_dark_beauty"],
    dominantPlantId: "aquilegia_atrata",
    tags: ["noir", "evening"],
    type: "party",
  },
  {
    id: "img_garden_white",
    url: photo("garden-white.webp"),
    gradient: "linear-gradient(180deg, #F5F3F0 0%, #F0EDE5 50%, #C8C0B8 100%)",
    source: "garden",
    sourceName: "Sissinghurst White Garden",
    plantIds: ["veronicastrum_album", "echinacea_pallida", "jacobaea_maritima"],
    dominantPlantId: "echinacea_pallida",
    tags: ["white-garden", "daylight"],
    type: "garden",
  },
  {
    id: "img_garden_blush",
    url: photo("garden-blush.webp"),
    gradient: "linear-gradient(150deg, #F0D5D0 0%, #E8C8B8 50%, #E85D75 100%)",
    source: "garden",
    sourceName: "Hidcote",
    plantIds: ["achillea_filipendulina", "cortaderia_pumila", "lycoris_radiata"],
    dominantPlantId: "lycoris_radiata",
    tags: ["blush", "summer"],
    type: "garden",
  },
  {
    id: "img_garden_poppy",
    url: photo("garden-poppy.webp"),
    gradient: "linear-gradient(135deg, #E03C31 0%, #C41E3A 45%, #B2226B 100%)",
    source: "garden",
    sourceName: "Giverny",
    plantIds: ["papaver_rhoeas", "lychnis_coronaria", "liatris_spicata"],
    dominantPlantId: "lychnis_coronaria",
    tags: ["poppy", "wild"],
    type: "garden",
  },
  {
    id: "img_garden_thistle",
    url: photo("garden-thistle.webp"),
    gradient: "linear-gradient(145deg, #6B8B9B 0%, #7B8DB8 50%, #8BB8D4 100%)",
    source: "garden",
    sourceName: "Oudolf Field",
    plantIds: ["echinops", "scabiosa", "salvia_uliginosa"],
    dominantPlantId: "scabiosa",
    tags: ["thistle", "cool"],
    type: "garden",
  },
  {
    id: "img_garden_dusk",
    url: photo("garden-dusk.webp"),
    gradient: "linear-gradient(160deg, #3D1F2E 0%, #8B5A4A 50%, #9B8B9B 100%)",
    source: "garden",
    sourceName: "Dusk Border",
    plantIds: ["prunus_nigra", "sanguisorba", "amorpha_canescens"],
    dominantPlantId: "sanguisorba",
    tags: ["dusk", "dark-foliage"],
    type: "garden",
  },
  {
    id: "img_jewelry_silver",
    url: photo("jewelry-silver.webp"),
    gradient: "linear-gradient(135deg, #E8E5DF 0%, #C8C0B8 50%, #6B8B9B 100%)",
    source: "magazine",
    sourceName: "Tatler",
    plantIds: ["briza_maxima", "jacobaea_maritima", "echinops"],
    dominantPlantId: "jacobaea_maritima",
    tags: ["platinum", "cool"],
    type: "jewelry",
  },
  {
    id: "img_jewelry_amber",
    url: photo("jewelry-amber.webp"),
    gradient: "linear-gradient(135deg, #E8A853 0%, #D4883A 50%, #B8886B 100%)",
    source: "magazine",
    sourceName: "Town & Country",
    plantIds: ["helenium", "pennisetum", "solidago_goldenmosa"],
    dominantPlantId: "helenium",
    tags: ["amber", "warm"],
    type: "jewelry",
  },
  {
    id: "img_jewelry_turquoise",
    url: photo("jewelry-turquoise.webp"),
    gradient: "linear-gradient(135deg, #8BB8D4 0%, #6B8B9B 50%, #B8886B 100%)",
    source: "magazine",
    sourceName: "Condé Nast Traveler",
    plantIds: ["salvia_uliginosa", "nassella_tenuissima", "pennisetum"],
    dominantPlantId: "salvia_uliginosa",
    tags: ["turquoise", "editorial"],
    type: "jewelry",
  },
  {
    id: "img_jewelry_ruby",
    url: photo("jewelry-ruby.webp"),
    gradient: "linear-gradient(135deg, #C41E3A 0%, #E03C31 50%, #3D1F2E 100%)",
    source: "magazine",
    sourceName: "Vogue",
    plantIds: ["papaver_rhoeas", "lychnis_coronaria", "prunus_nigra"],
    dominantPlantId: "papaver_rhoeas",
    tags: ["ruby", "inlay"],
    type: "jewelry",
  },
  {
    id: "img_jewelry_coral",
    url: photo("jewelry-coral.webp"),
    gradient: "linear-gradient(135deg, #E86A33 0%, #E85D75 50%, #B8886B 100%)",
    source: "magazine",
    sourceName: "W Magazine",
    plantIds: ["lycoris_radiata", "kniphofia_uvaria", "cortaderia_pumila"],
    dominantPlantId: "cortaderia_pumila",
    tags: ["coral", "leather"],
    type: "jewelry",
  },
  {
    id: "img_jewelry_opal",
    url: photo("jewelry-opal.webp"),
    gradient: "linear-gradient(135deg, #F5F0E8 0%, #D4C0D0 50%, #7B8DB8 100%)",
    source: "magazine",
    sourceName: "Numéro",
    plantIds: ["aquilegia_alba", "verbena_bonariensis", "scabiosa"],
    dominantPlantId: "aquilegia_alba",
    tags: ["opal", "moonstone"],
    type: "jewelry",
  },
];

const CAROUSEL_CAP = 27;

function interleave(groups: CarouselImage[][]): CarouselImage[] {
  const result: CarouselImage[] = [];
  const seen = new Set<string>();
  const maxLen = Math.max(...groups.map((g) => g.length), 0);
  for (let round = 0; round < maxLen && result.length < CAROUSEL_CAP; round++) {
    for (const group of groups) {
      const img = group[round];
      if (img && !seen.has(img.id)) {
        seen.add(img.id);
        result.push(img);
        if (result.length >= CAROUSEL_CAP) break;
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
    SEED_IMAGES.filter((img) => img.type === "party"),
    SEED_IMAGES.filter((img) => img.type === "garden"),
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
