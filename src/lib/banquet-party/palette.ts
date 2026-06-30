import type { ColorPalette, Material, Plant } from "@/lib/banquet-party/types";
import { getPlant, PLANTS } from "@/lib/banquet-party/plants";

const WARM_CATEGORIES = new Set(["yellow", "orange", "red"]);
const COOL_CATEGORIES = new Set(["purple", "pink", "green"]);
const NEUTRAL_CATEGORIES = new Set(["white", "neutral", "dark"]);

export function calculateColorPalette(materials: Material[]): ColorPalette {
  if (materials.length === 0) {
    return { primary: null, secondaries: [], accents: [], distribution: [] };
  }

  const colorCount = new Map<string, number>();
  for (const m of materials) {
    const key = m.plantColor.id;
    colorCount.set(key, (colorCount.get(key) ?? 0) + 1);
  }

  const sorted = Array.from(colorCount.entries()).sort((a, b) => b[1] - a[1]);
  const total = materials.length;

  const primary = getPlant(sorted[0]![0]) ?? null;
  const secondaries = sorted
    .slice(1, 4)
    .map(([id]) => getPlant(id))
    .filter((p): p is Plant => Boolean(p));
  const accents = sorted
    .slice(4, 7)
    .map(([id]) => getPlant(id))
    .filter((p): p is Plant => Boolean(p));

  return {
    primary,
    secondaries,
    accents,
    distribution: sorted.map(([plantId, count]) => ({
      plantId,
      percentage: Math.round((count / total) * 1000) / 10,
    })),
  };
}

export function recommendPalette(selectedPlant: Plant, excludeIds: string[] = []): Plant[] {
  const exclude = new Set([selectedPlant.id, ...excludeIds]);
  const pool = PLANTS.filter((p) => !exclude.has(p.id) && p.category !== selectedPlant.category);

  const wantCool = WARM_CATEGORIES.has(selectedPlant.category);
  const wantWarm = COOL_CATEGORIES.has(selectedPlant.category);
  const wantAny = NEUTRAL_CATEGORIES.has(selectedPlant.category);

  const scored = pool.map((p) => {
    let score = 0;
    if (wantCool && COOL_CATEGORIES.has(p.category)) score += 3;
    if (wantWarm && WARM_CATEGORIES.has(p.category)) score += 3;
    if (wantAny) score += 1;
    if (p.role === "secondary" || p.role === "base") score += 1;
    if (NEUTRAL_CATEGORIES.has(p.category) && !wantAny) score += 2;
    return { plant: p, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 4).map((s) => s.plant);
}

export function getPaletteReasonKey(primary: Plant, secondaries: Plant[]): string {
  const hasWarmPrimary = WARM_CATEGORIES.has(primary.category);
  const hasCoolSecondary = secondaries.some((p) => COOL_CATEGORIES.has(p.category));
  const hasWarmSecondary = secondaries.some((p) => WARM_CATEGORIES.has(p.category));
  const hasNeutral = secondaries.some((p) => NEUTRAL_CATEGORIES.has(p.category));

  if (hasWarmPrimary && hasCoolSecondary) return "warmCoolContrast";
  if (!hasWarmPrimary && hasWarmSecondary) return "coolWarmContrast";
  if (NEUTRAL_CATEGORIES.has(primary.category)) return "neutralAccent";
  if (hasNeutral) return "withNeutralSoftener";
  return "harmoniousMeadow";
}

export function computeWildnessIndex(materials: Material[]): { score: number; max: number; reasonKey: string } {
  if (materials.length === 0) return { score: 0, max: 5, reasonKey: "wildnessEmpty" };

  const categories = new Set(materials.map((m) => m.plantColor.category));
  const palette = calculateColorPalette(materials);

  let score = 0;
  if (categories.size >= 3) score += 1.5;
  if (categories.size >= 4) score += 0.5;

  const hasWarm = materials.some((m) => WARM_CATEGORIES.has(m.plantColor.category));
  const hasCool = materials.some((m) => COOL_CATEGORIES.has(m.plantColor.category));
  if (hasWarm && hasCool) score += 1.5;

  const hasNeutral = materials.some((m) => NEUTRAL_CATEGORIES.has(m.plantColor.category));
  if (hasNeutral) score += 1;
  else score += 0.3;

  if (palette.accents.length > 0) score += 0.5;

  const rounded = Math.min(5, Math.round(score * 10) / 10);
  let reasonKey = "wildnessBalanced";
  if (!hasNeutral && hasWarm && hasCool) reasonKey = "wildnessNeedsNeutral";
  if (categories.size < 3) reasonKey = "wildnessNeedsVariety";
  if (rounded >= 4.5) reasonKey = "wildnessExcellent";

  return { score: rounded, max: 5, reasonKey };
}
