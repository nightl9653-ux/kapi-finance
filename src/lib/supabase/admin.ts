import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** 服务端入账加量包（需 SUPABASE_SERVICE_ROLE_KEY）；勿在客户端使用 */
export function createSupabaseAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
