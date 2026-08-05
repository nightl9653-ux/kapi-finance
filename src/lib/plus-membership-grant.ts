import type { SupabaseClient } from "@supabase/supabase-js";

import { type PlusPlanId, addPlusPlanDuration, getPlusPlan } from "@/lib/plus-plans";

function isPlusOrdersTableMissingError(
  error: { code?: string; message?: string; details?: string } | null,
): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const text = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return text.includes("plus_membership_orders") && (text.includes("does not exist") || text.includes("could not find"));
}

export async function grantPlusMembership(params: {
  admin: SupabaseClient;
  userId: string;
  planId: PlusPlanId;
  provider: string;
  externalOrderId: string;
}): Promise<{ granted: boolean; reason?: string; expiresAt?: string | null }> {
  if (!getPlusPlan(params.planId)) return { granted: false, reason: "unknown_plan" };

  const { data: existing } = await params.admin
    .from("plus_membership_orders")
    .select("id")
    .eq("provider", params.provider)
    .eq("external_order_id", params.externalOrderId)
    .maybeSingle();

  if (existing?.id) return { granted: false, reason: "duplicate_order" };

  const { error: orderErr } = await params.admin.from("plus_membership_orders").insert({
    user_id: params.userId,
    plan_id: params.planId,
    provider: params.provider,
    external_order_id: params.externalOrderId,
  });

  if (orderErr) {
    if (isPlusOrdersTableMissingError(orderErr)) return { granted: false, reason: "orders_table_missing" };
    if (orderErr.code === "23505") return { granted: false, reason: "duplicate_order" };
    return { granted: false, reason: "order_insert_failed" };
  }

  const { data: profile } = await params.admin
    .from("profiles")
    .select("is_plus_member, plus_expires_at")
    .eq("id", params.userId)
    .maybeSingle();

  const now = new Date();
  const currentExpRaw = (profile as { plus_expires_at?: string | null } | null)?.plus_expires_at ?? null;
  const currentExp = currentExpRaw ? new Date(currentExpRaw) : null;
  const alreadyLifetime = Boolean(profile?.is_plus_member) && currentExpRaw == null;

  let plusExpiresAt: string | null;
  if (params.planId === "lifetime" || alreadyLifetime) {
    // 终身（含历史未写到期日的已开通用户）保持 null
    plusExpiresAt = null;
  } else {
    const base = currentExp && currentExp.getTime() > now.getTime() ? currentExp : now;
    const next = addPlusPlanDuration(base, params.planId);
    plusExpiresAt = next ? next.toISOString() : null;
  }

  const { error: profileErr } = await params.admin
    .from("profiles")
    .update({ is_plus_member: true, plus_expires_at: plusExpiresAt })
    .eq("id", params.userId);

  if (profileErr) return { granted: false, reason: "profile_update_failed" };

  return { granted: true, expiresAt: plusExpiresAt };
}
