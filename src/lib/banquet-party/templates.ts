import type { DrinkType, FoodFlavorTag, MaterialCategory, MenuCourse, TextureTag } from "@/lib/banquet-party/types";

export interface PartyMaterialTemplate {
  nameKey: string;
  category: MaterialCategory;
  plantId: string;
  quantity: number;
  price: number;
  texture?: TextureTag;
  flavor?: FoodFlavorTag;
  drinkType?: DrinkType;
  menuCourse?: MenuCourse;
}

export interface PartyTemplate {
  id: string;
  nameKey: string;
  descKey: string;
  characterId: string;
  materials: PartyMaterialTemplate[];
}

export const PARTY_TEMPLATES: PartyTemplate[] = [
  {
    id: "daughterBirthday",
    nameKey: "daughterBirthday",
    descKey: "daughterBirthdayDesc",
    characterId: "luna",
    materials: [
      { nameKey: "pinkBalloons", category: "decor", plantId: "achillea_filipendulina", quantity: 1, price: 88, texture: "glossy" },
      { nameKey: "birthdayCake", category: "food", plantId: "verbena_bonariensis", quantity: 1, price: 268, flavor: "sweet", menuCourse: "dessert" },
      { nameKey: "tableFlowers", category: "decor", plantId: "lycoris_radiata", quantity: 1, price: 120, texture: "natural" },
      { nameKey: "sparklingJuice", category: "drink", plantId: "briza_maxima", quantity: 6, price: 12, drinkType: "softDrink", menuCourse: "drink" },
      { nameKey: "partyFavors", category: "misc", plantId: "cortaderia_pumila", quantity: 10, price: 15, texture: "soft" },
    ],
  },
  {
    id: "gardenDinner",
    nameKey: "gardenDinner",
    descKey: "gardenDinnerDesc",
    characterId: "amal",
    materials: [
      { nameKey: "outdoorLights", category: "decor", plantId: "rudbeckia", quantity: 1, price: 199, texture: "metal" },
      { nameKey: "seasonalBouquet", category: "decor", plantId: "helenium", quantity: 2, price: 80, texture: "natural" },
    ],
  },
  {
    id: "custom",
    nameKey: "custom",
    descKey: "customDesc",
    characterId: "charlotte",
    materials: [],
  },
];

export function getPartyTemplate(id: string): PartyTemplate | undefined {
  return PARTY_TEMPLATES.find((t) => t.id === id);
}
