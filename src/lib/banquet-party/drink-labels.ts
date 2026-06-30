import type { DrinkType } from "@/lib/banquet-party/types";
import { DRINK_TYPE_EMOJI } from "@/lib/banquet-party/drinks";

type BanquetT = (key: string) => string;

export function drinkTypeLabel(t: BanquetT, drinkType: DrinkType): string {
  switch (drinkType) {
    case "aperitif":
      return t("drinkType.aperitif");
    case "sparkling":
      return t("drinkType.sparkling");
    case "whiteWine":
      return t("drinkType.whiteWine");
    case "redWine":
      return t("drinkType.redWine");
    case "spirit":
      return t("drinkType.spirit");
    case "cocktail":
      return t("drinkType.cocktail");
    case "softDrink":
      return t("drinkType.softDrink");
    case "water":
      return t("drinkType.water");
    case "coffeeTea":
      return t("drinkType.coffeeTea");
    case "other":
      return t("drinkType.other");
  }
}

export function drinkTypeDisplay(t: BanquetT, drinkType: DrinkType): string {
  return `${DRINK_TYPE_EMOJI[drinkType]} ${drinkTypeLabel(t, drinkType)}`;
}
