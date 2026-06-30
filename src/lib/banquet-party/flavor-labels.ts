import type { FoodFlavorTag } from "@/lib/banquet-party/types";

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
    case "crispy":
      return t("flavor.crispy");
    case "nourishing":
      return t("flavor.nourishing");
    case "medicinal":
      return t("flavor.medicinal");
    case "broth":
      return t("flavor.broth");
  }
}
