import type { MaterialCategory, ProjectPhase, ProjectType, RenovationRoom, SupplyType } from "@/lib/house-renovation/types";

type TFn = (key: string) => string;

export const MATERIAL_CATEGORY_ORDER: MaterialCategory[] = [
  "structure",
  "finishes",
  "appliances",
  "furnishing",
  "labor",
  "misc",
];

export const MATERIAL_CATEGORY_EMOJI: Record<MaterialCategory, string> = {
  structure: "🧱",
  finishes: "🪵",
  appliances: "🔌",
  furnishing: "🛋️",
  labor: "👷",
  misc: "📦",
};

export function categoryLabel(t: TFn, category: MaterialCategory): string {
  return t(`materialCategory.${category}`);
}

export function phaseLabel(t: TFn, phase: ProjectPhase): string {
  return t(`phase.${phase}`);
}

export function roomLabel(t: TFn, room: RenovationRoom): string {
  return t(`room.${room}`);
}

export function supplyTypeLabel(t: TFn, supply: SupplyType): string {
  return t(`supplyType.${supply}`);
}

export function projectTypeLabel(t: TFn, type: ProjectType): string {
  return t(`projectType.${type}`);
}
