import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

/**
 * 只用来寄改密信。不用 @supabase/ssr（那个库写死 PKCE，邮件会绑在点「忘了密码」的浏览器上）。
 * 登录会话仍走原来的 Cookie 客户端。
 */
export function sendPasswordResetEmail(email: string, redirectTo: string) {
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: "implicit",
    },
  });
  return client.auth.resetPasswordForEmail(email, { redirectTo });
}
