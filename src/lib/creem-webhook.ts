import { createHmac, timingSafeEqual } from "crypto";

import { type CreditPackId, getCreditPack } from "@/lib/credit-packs";
import { type PlusPlanId, getPlusPlan } from "@/lib/plus-plans";

export type CreemWebhookEvent = {
  eventType?: string;
  object?: Record<string, unknown>;
};

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readMetadata(root: Record<string, unknown>): Record<string, string> {
  const raw = root.metadata;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = String(v);
  }
  return out;
}

function readProductId(root: Record<string, unknown>): string {
  const product = root.product;
  if (typeof product === "string") return product.trim();
  if (product && typeof product === "object" && !Array.isArray(product)) {
    return readString((product as Record<string, unknown>).id);
  }
  const order = root.order;
  if (order && typeof order === "object" && !Array.isArray(order)) {
    return readString((order as Record<string, unknown>).product);
  }
  return "";
}

/** Creem Developers → Webhook 里的 Signing secret */
export function getCreemWebhookSecret(): string | null {
  return process.env.CREEM_WEBHOOK_SECRET?.trim() || null;
}

export function verifyCreemSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  const received = (signatureHeader ?? "").trim().toLowerCase();
  if (!received || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex").toLowerCase();
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(received, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function planIdFromCreemProduct(productId: string): PlusPlanId | null {
  const map: Array<[string, PlusPlanId]> = [
    ["CREEM_PRODUCT_ID_MONTHLY", "monthly"],
    ["CREEM_PRODUCT_ID_QUARTERLY", "quarterly"],
    ["CREEM_PRODUCT_ID_YEARLY", "yearly"],
    ["CREEM_PRODUCT_ID_LIFETIME", "lifetime"],
  ];
  for (const [envName, planId] of map) {
    const envProd = process.env[envName]?.trim();
    if (envProd && envProd === productId) return planId;
  }
  return null;
}

function packIdFromCreemProduct(productId: string): CreditPackId | null {
  const map: Array<[string, CreditPackId]> = [
    ["CREEM_PRODUCT_ID_IMAGES_20", "images_20"],
    ["CREEM_PRODUCT_ID_HQ_10", "hq_10"],
  ];
  for (const [envName, packId] of map) {
    const envProd = process.env[envName]?.trim();
    if (envProd && envProd === productId) return packId;
  }
  return null;
}

export type CreemGrantIntent =
  | { kind: "plus"; userId: string; planId: PlusPlanId; externalOrderId: string }
  | { kind: "pack"; userId: string; packId: CreditPackId; externalOrderId: string }
  | null;

/** 从 checkout.completed / subscription.paid 等事件解析入账意图 */
export function parseCreemGrantIntent(payload: CreemWebhookEvent): CreemGrantIntent {
  const eventType = readString(payload.eventType);
  const allowed = new Set(["checkout.completed", "subscription.paid", "subscription.active"]);
  if (!allowed.has(eventType)) return null;

  const obj = payload.object;
  if (!obj || typeof obj !== "object") return null;

  const meta = readMetadata(obj);
  const userId =
    meta.user_id || meta.userId || meta.referenceId || readString(obj.request_id);
  if (!userId) return null;

  const order = obj.order;
  const orderId =
    order && typeof order === "object" && !Array.isArray(order)
      ? readString((order as Record<string, unknown>).id)
      : "";
  const externalOrderId = orderId || readString(obj.id) || readString(payload.eventType);
  if (!externalOrderId) return null;

  const planIdRaw = (meta.plan_id || meta.planId) as PlusPlanId | "";
  if (planIdRaw && getPlusPlan(planIdRaw)) {
    return { kind: "plus", userId, planId: planIdRaw, externalOrderId };
  }

  const packIdRaw = (meta.pack_id || meta.packId) as CreditPackId | "";
  if (packIdRaw && getCreditPack(packIdRaw)) {
    return { kind: "pack", userId, packId: packIdRaw, externalOrderId };
  }

  const productId = readProductId(obj);
  if (productId) {
    const planId = planIdFromCreemProduct(productId);
    if (planId) return { kind: "plus", userId, planId, externalOrderId };
    const packId = packIdFromCreemProduct(productId);
    if (packId) return { kind: "pack", userId, packId, externalOrderId };
  }

  return null;
}
