import type { FoodFlavorTag } from "@/lib/banquet-party/types";

export const FOOD_FLAVOR_TAGS: FoodFlavorTag[] = [
  "spicy",
  "sweet",
  "sour",
  "light",
  "lowSugar",
  "lowOil",
  "lowSalt",
  "crispy",
  "savory",
  "numbing",
  "rich",
  "creamy",
  "smoked",
  "nourishing",
  "medicinal",
  "broth",
  "vegetarian",
  "halal",
  "glutenFree",
];

export function isKnownFoodFlavorTag(tag: string): tag is FoodFlavorTag {
  return (FOOD_FLAVOR_TAGS as string[]).includes(tag);
}

export function sanitizeFoodFlavors(tags?: FoodFlavorTag[] | FoodFlavorTag): FoodFlavorTag[] {
  const list = tags == null ? [] : Array.isArray(tags) ? tags : [tags];
  return list.filter(isKnownFoodFlavorTag);
}

export function isMenuCategory(category: string): boolean {
  return category === "food" || category === "drink";
}

export function isFoodCategory(category: string): boolean {
  return category === "food";
}

export function isDrinkCategory(category: string): boolean {
  return category === "drink";
}
