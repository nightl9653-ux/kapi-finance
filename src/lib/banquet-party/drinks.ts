import type { DrinkType, Material } from "@/lib/banquet-party/types";

export const DRINK_TYPE_ORDER: DrinkType[] = [
  "aperitif",
  "sparkling",
  "whiteWine",
  "redWine",
  "spirit",
  "cocktail",
  "softDrink",
  "water",
  "coffeeTea",
  "other",
];

export const DRINK_TYPE_EMOJI: Record<DrinkType, string> = {
  aperitif: "🥂",
  sparkling: "🍾",
  whiteWine: "🍷",
  redWine: "🍷",
  spirit: "🥃",
  cocktail: "🍸",
  softDrink: "🧃",
  water: "💧",
  coffeeTea: "🍵",
  other: "🍶",
};

export function resolveDrinkType(material: Material): DrinkType {
  if (material.category !== "drink") return "other";
  return material.drinkType ?? "other";
}

export function groupDrinkMaterials(materials: Material[]): { drinkType: DrinkType; items: Material[] }[] {
  const buckets = new Map<DrinkType, Material[]>();
  for (const dt of DRINK_TYPE_ORDER) {
    buckets.set(dt, []);
  }
  for (const m of materials) {
    if (m.category !== "drink") continue;
    buckets.get(resolveDrinkType(m))!.push(m);
  }
  return DRINK_TYPE_ORDER.map((drinkType) => ({ drinkType, items: buckets.get(drinkType)! })).filter(
    (g) => g.items.length > 0,
  );
}

export function defaultDrinkTypeForName(name: string): DrinkType | undefined {
  const n = name.toLowerCase();
  if (/香槟|prosecco|sparkling|起泡/.test(n)) return "sparkling";
  if (/咖啡|coffee|茶|tea|热巧/.test(n)) return "coffeeTea";
  if (/水|water/.test(n)) return "water";
  if (/果汁|汽水|可乐|juice|cola/.test(n)) return "softDrink";
  return undefined;
}
