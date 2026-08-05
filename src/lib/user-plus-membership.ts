import type { SupabaseClient } from "@supabase/supabase-js";

export type PlusMembershipRow = {
  is_plus_member?: boolean | null;
  plus_expires_at?: string | null;
};

/** 是否仍有效：已开通，且终身（无到期日）或未过期 */
export function isPlusMembershipActive(row: PlusMembershipRow | null | undefined, now = new Date()): boolean {
  if (!row?.is_plus_member) return false;
  if (row.plus_expires_at == null || row.plus_expires_at === "") return true;
  const exp = new Date(row.plus_expires_at);
  if (Number.isNaN(exp.getTime())) return false;
  return exp.getTime() > now.getTime();
}

async function revokeExpiredPlus(supabase: SupabaseClient, userId: string): Promise<void> {
  try {
    await supabase
      .from("profiles")
      .update({ is_plus_member: false })
      .eq("id", userId)
      .eq("is_plus_member", true);
  } catch {
    // 浏览器端若无 update 权限也无妨：读路径仍按到期日判为非会员
  }
}

export async function fetchUserIsPlusMember(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_plus_member, plus_expires_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) return false;

  const row = data as PlusMembershipRow | null;
  if (!row?.is_plus_member) return false;

  if (isPlusMembershipActive(row)) return true;

  await revokeExpiredPlus(supabase, userId);
  return false;
}
