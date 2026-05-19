import type { SupabaseClient } from "@supabase/supabase-js";

import { type CreditPackId, getCreditPack } from "@/lib/credit-packs";
import { isAiUsageColumnMissingError } from "@/lib/ai-usage-column-error";

export type ImageCreditsBalance = {
  standard: number;
  hq: number;
  expiresAt: string | null;
};

function isImageCreditsTableMissingError(
  error: { code?: string; message?: string; details?: string } | null,
): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const text = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return text.includes("ai_image_credits") && (text.includes("does not exist") || text.includes("could not find"));
}

function normalizeBalance(row: {
  standard_images_remaining?: number | null;
  hq_images_remaining?: number | null;
  expires_at?: string | null;
} | null): ImageCreditsBalance {
  if (!row?.expires_at) return { standard: 0, hq: 0, expiresAt: null };
  const expiresAt = String(row.expires_at);
  if (Date.parse(expiresAt) <= Date.now()) {
    return { standard: 0, hq: 0, expiresAt };
  }
  return {
    standard: Math.max(0, Number(row.standard_images_remaining ?? 0)),
    hq: Math.max(0, Number(row.hq_images_remaining ?? 0)),
    expiresAt,
  };
}

export async function fetchImageCreditsBalance(
  supabase: SupabaseClient,
  userId: string,
): Promise<ImageCreditsBalance> {
  const { data, error } = await supabase
    .from("ai_image_credits")
    .select("standard_images_remaining, hq_images_remaining, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (isImageCreditsTableMissingError(error)) return { standard: 0, hq: 0, expiresAt: null };
    throw new Error("credits_query_failed");
  }
  return normalizeBalance(data);
}

export async function consumeImageCredits(
  admin: SupabaseClient,
  userId: string,
  highQuality: boolean,
  shots: number,
): Promise<void> {
  const { data, error } = await admin
    .from("ai_image_credits")
    .select(`user_id, standard_images_remaining, hq_images_remaining, expires_at`)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (isImageCreditsTableMissingError(error)) throw new Error("credits_write_failed");
    throw new Error("credits_write_failed");
  }
  const balance = normalizeBalance(data);
  const available = highQuality ? balance.hq : balance.standard;
  if (available < shots) throw new Error("credits_insufficient");

  const row = data as {
    standard_images_remaining?: number;
    hq_images_remaining?: number;
    expires_at?: string;
  } | null;
  if (!row?.expires_at) throw new Error("credits_insufficient");

  const nextStandard = highQuality
    ? Number(row.standard_images_remaining ?? 0)
    : Number(row.standard_images_remaining ?? 0) - shots;
  const nextHq = highQuality ? Number(row.hq_images_remaining ?? 0) - shots : Number(row.hq_images_remaining ?? 0);

  const { error: upErr } = await admin
    .from("ai_image_credits")
    .update({
      standard_images_remaining: Math.max(0, nextStandard),
      hq_images_remaining: Math.max(0, nextHq),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (upErr) throw new Error("credits_write_failed");
}

export async function grantImageCreditsPack(params: {
  admin: SupabaseClient;
  userId: string;
  packId: CreditPackId;
  provider: string;
  externalOrderId: string;
}): Promise<{ granted: boolean; reason?: string }> {
  const pack = getCreditPack(params.packId);
  if (!pack) return { granted: false, reason: "unknown_pack" };

  const { data: existingPurchase } = await params.admin
    .from("ai_credit_purchases")
    .select("id")
    .eq("provider", params.provider)
    .eq("external_order_id", params.externalOrderId)
    .maybeSingle();
  if (existingPurchase?.id) return { granted: false, reason: "duplicate_order" };

  const expiresAt = new Date(Date.now() + pack.validDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: row } = await params.admin
    .from("ai_image_credits")
    .select("standard_images_remaining, hq_images_remaining, expires_at")
    .eq("user_id", params.userId)
    .maybeSingle();

  const balance = normalizeBalance(row);
  const stillActive = balance.expiresAt && Date.parse(balance.expiresAt) > Date.now();
  const nextStandard = (stillActive ? balance.standard : 0) + pack.standardImages;
  const nextHq = (stillActive ? balance.hq : 0) + pack.hqImages;

  const { error: upsertErr } = await params.admin.from("ai_image_credits").upsert(
    {
      user_id: params.userId,
      standard_images_remaining: nextStandard,
      hq_images_remaining: nextHq,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (upsertErr) return { granted: false, reason: "credits_upsert_failed" };

  const { error: purchaseErr } = await params.admin.from("ai_credit_purchases").insert({
    user_id: params.userId,
    pack_id: pack.id,
    provider: params.provider,
    external_order_id: params.externalOrderId,
    standard_granted: pack.standardImages,
    hq_granted: pack.hqImages,
  });
  if (purchaseErr) {
    if (isAiUsageColumnMissingError(purchaseErr) || purchaseErr.code === "23505") {
      return { granted: false, reason: "purchase_insert_failed" };
    }
    return { granted: false, reason: "purchase_insert_failed" };
  }

  return { granted: true };
}
