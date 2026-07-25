import type { DecorAtmosphereTag, DecorZone, Material } from "@/lib/banquet-party/types";

export const DECOR_ZONE_ORDER: DecorZone[] = [
  "entrance",
  "table",
  "photo",
  "scentAir",
  "avLighting",
  "overhead",
  "floor",
  "wearable",
];

export const DECOR_ZONE_EMOJI: Record<DecorZone, string> = {
  entrance: "🚪",
  table: "🍽️",
  photo: "📸",
  avLighting: "🎛️",
  overhead: "🎈",
  floor: "🪑",
  scentAir: "🌬️",
  wearable: "🎭",
};

export const DECOR_WEARABLE_HINT_GROUPS = ["headwear", "jewelry", "handheld", "apparel"] as const;
export type DecorWearableHintGroup = (typeof DECOR_WEARABLE_HINT_GROUPS)[number];

/** 装饰氛围 / 质感标签（单列表，可多选） */
export const DECOR_ATMOSPHERE_TAGS: DecorAtmosphereTag[] = [
  "silk",
  "metal",
  "wood",
  "glass",
  "plush",
  "paper",
  "plastic",
  "natural",
  "pearl",
  "diamond",
  "agateMoonstone",
  "platinumSilver",
  "amberTurquoise",
  "goldWhiteGold",
  "gemInlay",
  "leatherCoral",
  "opalTourmalineSpinel",
];

export function isDecorCategory(category: string): boolean {
  return category === "decor";
}

export function isKnownDecorAtmosphereTag(tag: string): tag is DecorAtmosphereTag {
  return (DECOR_ATMOSPHERE_TAGS as string[]).includes(tag);
}

export function sanitizeDecorAtmosphere(tags?: DecorAtmosphereTag[]): DecorAtmosphereTag[] {
  return (tags ?? []).filter(isKnownDecorAtmosphereTag);
}

export function resolveDecorZone(material: Material): DecorZone {
  if (material.category !== "decor") return "table";
  return material.decorZone ?? "table";
}

export function groupDecorMaterials(materials: Material[]): { zone: DecorZone; items: Material[] }[] {
  const buckets = new Map<DecorZone, Material[]>();
  for (const zone of DECOR_ZONE_ORDER) {
    buckets.set(zone, []);
  }
  for (const m of materials) {
    if (m.category !== "decor") continue;
    buckets.get(resolveDecorZone(m))!.push(m);
  }
  return DECOR_ZONE_ORDER.map((zone) => ({ zone, items: buckets.get(zone)! })).filter((g) => g.items.length > 0);
}

export function summarizeDecorAtmosphere(materials: Material[]): { tag: DecorAtmosphereTag; count: number }[] {
  const counts = new Map<DecorAtmosphereTag, number>();
  for (const m of materials) {
    if (m.category !== "decor") continue;
    for (const tag of sanitizeDecorAtmosphere(m.decorAtmosphere)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}
