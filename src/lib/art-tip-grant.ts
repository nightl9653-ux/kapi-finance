import type { SupabaseClient } from "@supabase/supabase-js";

import { artTipAmountUsd, parseArtPostId, parseArtTipUnits } from "@/lib/art-board";
import { getArtGrantSecret, getArtGrantUrl } from "@/lib/art-site-secret";

export type ArtTipGrantResult = { granted: boolean; reason?: string };

function isDuplicateReason(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  const text = `${error.message ?? ""}`.toLowerCase();
  return text.includes("duplicate") || text.includes("unique");
}

function isMissingTableError(error: { code?: string; message?: string; details?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const text = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return text.includes("does not exist") || text.includes("could not find");
}

async function notifyArtSiteGrant(params: {
  postId: string;
  units: number;
  amount: number;
  provider: string;
  externalOrderId: string;
}): Promise<ArtTipGrantResult> {
  const secret = getArtGrantSecret();
  if (!secret) return { granted: false, reason: "grant_not_configured" };

  let res: Response;
  try {
    res = await fetch(getArtGrantUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        post_id: params.postId,
        units: params.units,
        amount: params.amount,
        provider: params.provider,
        external_order_id: params.externalOrderId,
      }),
      cache: "no-store",
    });
  } catch {
    return { granted: false, reason: "art_notify_failed" };
  }

  let json: { ok?: boolean; error?: string } = {};
  try {
    json = (await res.json()) as { ok?: boolean; error?: string };
  } catch {
    json = {};
  }

  if (res.status === 404 || json.error === "post_not_found") {
    return { granted: false, reason: "post_not_found" };
  }
  if (res.ok && json.ok === false && json.error === "duplicate_order") {
    return { granted: false, reason: "duplicate_order" };
  }
  if (!res.ok || json.ok === false) {
    return { granted: false, reason: json.error || "art_notify_failed" };
  }
  return { granted: true };
}

export async function grantArtPostPayment(params: {
  admin: SupabaseClient;
  postId: string;
  userId?: string | null;
  units: number;
  provider: string;
  externalOrderId: string;
}): Promise<ArtTipGrantResult> {
  const postId = parseArtPostId(params.postId);
  const units = parseArtTipUnits(params.units);
  if (!postId) return { granted: false, reason: "invalid_post" };
  if (!units) return { granted: false, reason: "invalid_units" };

  const amount = artTipAmountUsd(units);
  const payerId = parseArtPostId(params.userId);
  const { data, error } = await params.admin.rpc("apply_art_post_payment", {
    p_post_id: postId,
    p_user_id: payerId,
    p_units: units,
    p_amount: amount,
    p_provider: params.provider,
    p_external_order_id: params.externalOrderId,
  });

  let recorded = true;
  let duplicate = false;
  if (error) {
    if (isDuplicateReason(error)) {
      duplicate = true;
      recorded = true;
    } else if (isMissingTableError(error)) {
      return { granted: false, reason: "payments_table_missing" };
    } else {
      return { granted: false, reason: "grant_failed" };
    }
  } else {
    const row = data as { granted?: boolean; reason?: string } | null;
    if (row && row.granted === false) {
      if (row.reason === "duplicate_order") duplicate = true;
      else return { granted: false, reason: row.reason || "not_granted" };
    }
  }

  const notified = await notifyArtSiteGrant({
    postId,
    units,
    amount,
    provider: params.provider,
    externalOrderId: params.externalOrderId,
  });

  if (!notified.granted) {
    if (notified.reason === "duplicate_order" && duplicate) {
      return { granted: false, reason: "duplicate_order" };
    }
    if (notified.reason === "post_not_found") {
      return { granted: recorded && !duplicate, reason: duplicate ? "duplicate_order" : "post_not_found" };
    }
    return { granted: false, reason: notified.reason || "art_notify_failed" };
  }

  if (duplicate) return { granted: true };
  return { granted: true };
}
