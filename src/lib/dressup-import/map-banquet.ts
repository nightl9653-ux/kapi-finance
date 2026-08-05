import { SOUL_CHARACTERS } from "@/lib/banquet-party/characters";
import { PLANTS } from "@/lib/banquet-party/plants";
import { createDefaultTimeline } from "@/lib/banquet-party/timeline";
import { calculateColorPalette } from "@/lib/banquet-party/palette";
import { newMaterialId, newPartyId, newTimelineTaskId } from "@/lib/banquet-party/storage";
import type { DecorZone, Material, MaterialCategory, Party } from "@/lib/banquet-party/types";
import { BASE_CURRENCY } from "@/lib/fx";

type SlotItem = { slot?: string; name?: string };

const SLOT_TO_DECOR: Record<string, DecorZone> = {
  桌花: "table",
  桌布: "table",
  灯光: "avLighting",
  背景: "photo",
  顶饰: "overhead",
  地面: "floor",
  迎宾: "entrance",
  主宾装: "wearable",
  宾客装: "wearable",
};

function categoryForSlot(slot: string): MaterialCategory {
  if (slot.includes("甜品") || slot.includes("餐")) return "food";
  if (slot.includes("装") || slot.includes("灯") || slot.includes("布") || slot.includes("花") || slot.includes("景") || slot.includes("顶") || slot.includes("地") || slot.includes("迎")) {
    return "decor";
  }
  return "misc";
}

function todayISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 宅宴宴会清单草稿 → 咔账宴会 */
export function mapDressupBanquetDraft(data: Record<string, unknown>): Party {
  const items = Array.isArray(data.items) ? (data.items as SlotItem[]) : [];
  const score = data.score as { fengshui?: number; aesthetic?: number; note?: string } | undefined;
  const plant = PLANTS[0]!;
  const now = new Date().toISOString();

  const materials: Material[] = items.map((it) => {
    const slot = String(it.slot ?? "").trim() || "细项";
    const name = String(it.name ?? "").trim() || slot;
    const category = categoryForSlot(slot);
    const material: Material = {
      id: newMaterialId(),
      name: `${slot}：${name}`,
      quantity: 1,
      price: 0,
      category,
      plantColor: plant,
      isPurchased: false,
      characterNote: "来自宅宴宴席台",
    };
    if (category === "decor") {
      material.decorZone = SLOT_TO_DECOR[slot] ?? "table";
    }
    if (category === "misc") {
      material.miscType = slot.includes("伴手") ? "favor" : slot.includes("座位") ? "print" : "other";
    }
    if (category === "food") {
      material.menuCourse = "dessert";
    }
    return material;
  });

  if (materials.length === 0) {
    materials.push({
      id: newMaterialId(),
      name: "宴会细项（待补）",
      quantity: 1,
      price: 0,
      category: "misc",
      plantColor: plant,
      isPurchased: false,
      miscType: "other",
      characterNote: "宅宴草稿暂无细项",
    });
  }

  const scoreBit =
    score != null
      ? `宅宴评分 风水${score.fengshui ?? "—"} / 审美${score.aesthetic ?? "—"}${score.note ? ` · ${score.note}` : ""}`
      : undefined;

  const base: Party = {
    id: newPartyId(),
    name: `宅宴宴会 · ${todayISODate()}`,
    date: todayISODate(),
    characterId: SOUL_CHARACTERS[0]?.id ?? "luna",
    currency: BASE_CURRENCY,
    materials,
    colorPalette: { primary: null, secondaries: [], accents: [], distribution: [] },
    guests: [],
    timeline: createDefaultTimeline(newTimelineTaskId),
    createdAt: now,
    updatedAt: now,
  };

  const withPalette = { ...base, colorPalette: calculateColorPalette(materials) };
  if (scoreBit) {
    // 把评分记在第一条材质备注里，避免改 Party 类型
    const first = withPalette.materials[0];
    if (first) {
      first.characterNote = [first.characterNote, scoreBit].filter(Boolean).join(" · ");
    }
  }
  return withPalette;
}
