import type { FoodFlavorTag } from "@/lib/banquet-party/types";
import { sanitizeFoodFlavors } from "@/lib/banquet-party/flavors";

type BanquetT = (key: string) => string;

export function foodFlavorLabel(t: BanquetT, flavor: FoodFlavorTag): string {
  switch (flavor) {
    case "spicy":
      return t("flavor.spicy");
    case "sweet":
      return t("flavor.sweet");
    case "sour":
      return t("flavor.sour");
    case "light":
      return t("flavor.light");
    case "lowSugar":
      return t("flavor.lowSugar");
    case "lowOil":
      return t("flavor.lowOil");
    case "lowSalt":
      return t("flavor.lowSalt");
    case "crispy":
      return t("flavor.crispy");
    case "savory":
      return t("flavor.savory");
    case "numbing":
      return t("flavor.numbing");
    case "rich":
      return t("flavor.rich");
    case "creamy":
      return t("flavor.creamy");
    case "smoked":
      return t("flavor.smoked");
    case "nourishing":
      return t("flavor.nourishing");
    case "medicinal":
      return t("flavor.medicinal");
    case "broth":
      return t("flavor.broth");
    case "vegetarian":
      return t("flavor.vegetarian");
    case "halal":
      return t("flavor.halal");
    case "glutenFree":
      return t("flavor.glutenFree");
  }
}

export function foodFlavorsLabel(t: BanquetT, flavors: FoodFlavorTag[]): string {
  return sanitizeFoodFlavors(flavors)
    .map((f) => foodFlavorLabel(t, f))
    .join("、");
}
