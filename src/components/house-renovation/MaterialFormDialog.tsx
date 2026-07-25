"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MATERIAL_CATEGORY_ORDER, categoryLabel, phaseLabel, roomLabel, supplyTypeLabel } from "@/lib/house-renovation/labels";
import { phasesForProjectType } from "@/lib/house-renovation/phases";
import type {
  MaterialCategory,
  ProjectPhase,
  ProjectType,
  RenovationMaterial,
  RenovationRoom,
  SupplyType,
} from "@/lib/house-renovation/types";
import { cn } from "@/lib/utils";

const ROOMS: RenovationRoom[] = ["whole", "living", "kitchen", "bathroom", "bedroom", "balcony", "exterior"];
const SUPPLY_TYPES: SupplyType[] = ["selfPurchase", "turnkey", "laborOnly"];

export function MaterialFormDialog({
  projectType,
  defaultPhase,
  mode,
  initial,
  onClose,
  onSave,
}: {
  projectType: ProjectType;
  defaultPhase: ProjectPhase;
  mode: "add" | "edit";
  initial?: RenovationMaterial;
  onClose: () => void;
  onSave: (m: Omit<RenovationMaterial, "id">) => void;
}) {
  const t = useTranslations("houseRenovation");
  const tCommon = useTranslations("common");
  const phases = phasesForProjectType(projectType);

  const [name, setName] = useState(initial?.name ?? "");
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1));
  const [price, setPrice] = useState(initial?.price != null ? String(initial.price) : "");
  const [category, setCategory] = useState<MaterialCategory>(initial?.category ?? "finishes");
  const [phase, setPhase] = useState<ProjectPhase>(initial?.phase ?? defaultPhase);
  const [room, setRoom] = useState<RenovationRoom | "">(initial?.room ?? "");
  const [supplyType, setSupplyType] = useState<SupplyType | "">(initial?.supplyType ?? "");
  const [note, setNote] = useState(initial?.note ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(quantity);
    const unitPrice = Number(price);
    if (!name.trim() || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) return;
    onSave({
      name: name.trim(),
      quantity: qty,
      price: unitPrice,
      category,
      phase,
      room: room || undefined,
      supplyType: supplyType || undefined,
      isPurchased: initial?.isPurchased ?? false,
      note: note.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <form
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border bg-background p-5 shadow-lg"
        autoComplete="off"
      >
        <h3 className="font-medium">{mode === "add" ? t("addMaterial") : t("editMaterial")}</h3>

        <div className="mt-4 space-y-3">
          <div className="space-y-1">
            <Label>{t("materialName")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="off" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t("quantity")}</Label>
              <Input
                type="number"
                min={0.01}
                step={0.01}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label>{t("unitPrice")}</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                autoComplete="one-time-code"
                name="material-unit-price"
                inputMode="decimal"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>{t("materialCategoryLabel")}</Label>
            <div className="flex flex-wrap gap-1">
              {MATERIAL_CATEGORY_ORDER.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    "rounded-full border px-2 py-1 text-xs",
                    category === c ? "border-foreground bg-muted" : "bg-white/60",
                  )}
                >
                  {categoryLabel(t, c)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label>{t("phaseLabel")}</Label>
            <select
              className="flex h-9 w-full rounded-md border bg-white px-3 text-sm"
              value={phase}
              onChange={(e) => setPhase(e.target.value as ProjectPhase)}
            >
              {phases.map((p) => (
                <option key={p} value={p}>
                  {phaseLabel(t, p)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label>{t("roomLabel")}</Label>
            <select
              className="flex h-9 w-full rounded-md border bg-white px-3 text-sm"
              value={room}
              onChange={(e) => setRoom(e.target.value as RenovationRoom | "")}
            >
              <option value="">{t("roomUnset")}</option>
              {ROOMS.map((r) => (
                <option key={r} value={r}>
                  {roomLabel(t, r)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label>{t("supplyTypeLabel")}</Label>
            <select
              className="flex h-9 w-full rounded-md border bg-white px-3 text-sm"
              value={supplyType}
              onChange={(e) => setSupplyType(e.target.value as SupplyType | "")}
            >
              <option value="">{t("supplyUnset")}</option>
              {SUPPLY_TYPES.map((s) => (
                <option key={s} value={s}>
                  {supplyTypeLabel(t, s)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label>{t("note")}</Label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className={cn(
                "w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base outline-none",
                "transition-colors placeholder:text-muted-foreground",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                "md:text-sm dark:bg-input/30",
              )}
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button type="submit" className="rounded-full">
            {tCommon("save")}
          </Button>
          <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
