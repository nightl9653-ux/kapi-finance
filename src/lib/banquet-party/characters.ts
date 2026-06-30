import type { SoulCharacter } from "@/lib/banquet-party/types";

export const SOUL_CHARACTERS: SoulCharacter[] = [
  {
    id: "daisy",
    nameKey: "daisy",
    styleKey: "daisyStyle",
    jewelryKey: "daisyJewelry",
    attireKey: "daisyAttire",
    sceneKey: "daisyScene",
    recommendedPlantIds: ["rudbeckia", "helenium", "prunus_nigra", "echinacea_pallida"],
    emoji: "💎",
  },
  {
    id: "amal",
    nameKey: "amal",
    styleKey: "amalStyle",
    jewelryKey: "amalJewelry",
    attireKey: "amalAttire",
    sceneKey: "amalScene",
    recommendedPlantIds: ["achillea_filipendulina", "verbena_bonariensis", "pennisetum", "nassella_tenuissima"],
    emoji: "🌾",
  },
  {
    id: "charlotte",
    nameKey: "charlotte",
    styleKey: "charlotteStyle",
    jewelryKey: "charlotteJewelry",
    attireKey: "charlotteAttire",
    sceneKey: "charlotteScene",
    recommendedPlantIds: ["veronicastrum_album", "briza_maxima", "jacobaea_maritima", "scabiosa"],
    emoji: "✨",
  },
  {
    id: "jasmine",
    nameKey: "jasmine",
    styleKey: "jasmineStyle",
    jewelryKey: "jasmineJewelry",
    attireKey: "jasmineAttire",
    sceneKey: "jasmineScene",
    recommendedPlantIds: ["rudbeckia", "solidago_goldenmosa", "kniphofia_uvaria", "aster_twilight"],
    emoji: "👑",
  },
  {
    id: "margot",
    nameKey: "margot",
    styleKey: "margotStyle",
    jewelryKey: "margotJewelry",
    attireKey: "margotAttire",
    sceneKey: "margotScene",
    recommendedPlantIds: ["papaver_rhoeas", "lychnis_coronaria", "prunus_nigra", "liatris_spicata"],
    emoji: "⛓️",
  },
  {
    id: "luna",
    nameKey: "luna",
    styleKey: "lunaStyle",
    jewelryKey: "lunaJewelry",
    attireKey: "lunaAttire",
    sceneKey: "lunaScene",
    recommendedPlantIds: ["salvia_uliginosa", "briza_maxima", "verbena_bonariensis", "thalictrum"],
    emoji: "🌙",
  },
];

const charMap = new Map(SOUL_CHARACTERS.map((c) => [c.id, c]));

export function getSoulCharacter(id: string): SoulCharacter | undefined {
  return charMap.get(id);
}
