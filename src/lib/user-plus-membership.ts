import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchUserIsPlusMember(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_plus_member")
    .eq("id", userId)
    .maybeSingle();
  if (error) return false;
  return Boolean((data as { is_plus_member?: boolean | null } | null)?.is_plus_member);
}
