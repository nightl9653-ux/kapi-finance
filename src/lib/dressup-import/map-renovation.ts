import { newMaterialId, newProjectId } from "@/lib/house-renovation/storage";
import type { MaterialCategory, RenovationMaterial, RenovationProject } from "@/lib/house-renovation/types";
import { BASE_CURRENCY } from "@/lib/fx";

type YardItemRow = { name?: string; kind?: string; qty?: number };

function categoryForYardKind(kind: string | undefined): MaterialCategory {
  switch (kind) {
    case "tree":
    case "plant":
    case "water":
      return "furnishing";
    case "lantern":
    case "stone":
    case "seat":
      return "furnishing";
    default:
      return "misc";
  }
}

/** 宅宴装修草稿 → 咔账装修项目 */
export function mapDressupHouseDraft(data: Record<string, unknown>): RenovationProject {
  const formLabel = typeof data.formLabel === "string" && data.formLabel.trim() ? data.formLabel.trim() : "四合院";
  const yardItems = Array.isArray(data.yardItems) ? (data.yardItems as YardItemRow[]) : [];
  const score = data.score as { fengshui?: number; aesthetic?: number; note?: string } | undefined;
  const now = new Date().toISOString();

  const materials: RenovationMaterial[] = yardItems.map((it) => {
    const name = String(it.name ?? "").trim() || "庭院物件";
    const qty = Math.max(1, Number(it.qty) || 1);
    return {
      id: newMaterialId(),
      name,
      quantity: qty,
      price: 0,
      category: categoryForYardKind(typeof it.kind === "string" ? it.kind : undefined),
      phase: "landscaping",
      room: "exterior",
      supplyType: "selfPurchase",
      isPurchased: false,
      note: "来自宅宴庭院摆放",
    };
  });

  if (materials.length === 0) {
    materials.push({
      id: newMaterialId(),
      name: "庭院软装（待补）",
      quantity: 1,
      price: 0,
      category: "misc",
      phase: "landscaping",
      room: "exterior",
      supplyType: "selfPurchase",
      isPurchased: false,
      note: "宅宴草稿暂无物件",
    });
  }

  const scoreNote =
    score != null
      ? `宅宴评分 风水${score.fengshui ?? "—"} / 审美${score.aesthetic ?? "—"}${score.note ? ` · ${score.note}` : ""}`
      : undefined;

  return {
    id: newProjectId(),
    name: `宅宴 · ${formLabel}`,
    projectType: "construction",
    currency: BASE_CURRENCY,
    currentPhase: "landscaping",
    address: scoreNote,
    materials,
    createdAt: now,
    updatedAt: now,
  };
}
