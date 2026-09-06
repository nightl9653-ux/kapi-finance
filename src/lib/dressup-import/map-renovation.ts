import { newMaterialId, newProjectId } from "@/lib/house-renovation/storage";
import type { MaterialCategory, RenovationMaterial, RenovationProject } from "@/lib/house-renovation/types";
import { BASE_CURRENCY } from "@/lib/fx";

type ItemRow = { name?: string; kind?: string; qty?: number };

function categoryForKind(kind: string | undefined): MaterialCategory {
  switch (kind) {
    case "tree":
    case "plant":
    case "water":
    case "lantern":
    case "stone":
    case "seat":
    case "table":
    case "decor":
    case "figure":
      return "furnishing";
    default:
      return "misc";
  }
}

function materialFromRow(
  it: ItemRow,
  fallbackName: string,
  phase: RenovationMaterial["phase"],
  room: NonNullable<RenovationMaterial["room"]>,
  note: string,
): RenovationMaterial {
  const name = String(it.name ?? "").trim() || fallbackName;
  const qty = Math.max(1, Number(it.qty) || 1);
  return {
    id: newMaterialId(),
    name,
    quantity: qty,
    price: 0,
    category: categoryForKind(typeof it.kind === "string" ? it.kind : undefined),
    phase,
    room,
    supplyType: "selfPurchase",
    isPurchased: false,
    note,
  };
}

/** 宅宴装修草稿 → 咔账装修项目 */
export function mapDressupHouseDraft(data: Record<string, unknown>): RenovationProject {
  const formLabel = typeof data.formLabel === "string" && data.formLabel.trim() ? data.formLabel.trim() : "四合院";
  const interiorLabel =
    typeof data.interiorLabel === "string" && data.interiorLabel.trim() ? data.interiorLabel.trim() : "室内";
  const yardItems = Array.isArray(data.yardItems) ? (data.yardItems as ItemRow[]) : [];
  const interiorItems = Array.isArray(data.interiorItems) ? (data.interiorItems as ItemRow[]) : [];
  const score = data.score as { fengshui?: number; aesthetic?: number; note?: string } | undefined;
  const now = new Date().toISOString();

  const materials: RenovationMaterial[] = [
    ...yardItems.map((it) => materialFromRow(it, "庭院物件", "landscaping", "exterior", "来自宅宴庭院摆放")),
    ...interiorItems.map((it) =>
      materialFromRow(it, "室内物件", "interiorFinish", "living", `来自宅宴室内摆放 · ${interiorLabel}`),
    ),
  ];

  if (materials.length === 0) {
    materials.push({
      id: newMaterialId(),
      name: "软装（待补）",
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
    currentPhase: interiorItems.length > 0 && yardItems.length === 0 ? "interiorFinish" : "landscaping",
    address: scoreNote,
    materials,
    createdAt: now,
    updatedAt: now,
  };
}
