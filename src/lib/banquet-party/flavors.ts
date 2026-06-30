import type { FoodFlavorTag } from "@/lib/banquet-party/types";

export const FOOD_FLAVOR_TAGS: FoodFlavorTag[] = [
  "spicy",
  "sweet",
  "sour",
  "light",
  "lowSugar",
  "lowOil",
  "crispy",
  "nourishing",
  "medicinal",
  "broth",
];

export function isMenuCategory(category: string): boolean {
  return category === "food" || category === "drink";
}

export function isFoodCategory(category: string): boolean {
  return category === "food";
}

export function isDrinkCategory(category: string): boolean {
  return category === "drink";
}
