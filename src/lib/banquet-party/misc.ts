import type { Material, MiscType } from "@/lib/banquet-party/types";

export const MISC_TYPE_ORDER: MiscType[] = [
  "favor",
  "service",
  "venue",
  "media",
  "print",
  "entertainment",
  "logistics",
  "deposit",
  "other",
];

export const MISC_TYPE_EMOJI: Record<MiscType, string> = {
  favor: "🎁",
  service: "👥",
  venue: "🏛️",
  media: "📷",
  print: "📄",
  entertainment: "🎭",
  logistics: "🚚",
  deposit: "💰",
  other: "📋",
};

export function isMiscCategory(category: string): boolean {
  return category === "misc";
}

export function isKnownMiscType(type: string): type is MiscType {
  return (MISC_TYPE_ORDER as string[]).includes(type);
}

export function resolveMiscType(material: Material): MiscType {
  if (material.category !== "misc") return "other";
  return material.miscType ?? "other";
}

export function groupMiscMaterials(materials: Material[]): { miscType: MiscType; items: Material[] }[] {
  const buckets = new Map<MiscType, Material[]>();
  for (const type of MISC_TYPE_ORDER) {
    buckets.set(type, []);
  }
  for (const m of materials) {
    if (m.category !== "misc") continue;
    buckets.get(resolveMiscType(m))!.push(m);
  }
  return MISC_TYPE_ORDER.map((miscType) => ({ miscType, items: buckets.get(miscType)! })).filter(
    (g) => g.items.length > 0,
  );
}
