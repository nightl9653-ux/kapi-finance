import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js";

import { peekPasswordResetIntent } from "@/lib/password-reset";

const OTP_TYPES = new Set<string>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function stripAuthParams() {
  const url = new URL(window.location.href);
  for (const key of ["code", "token_hash", "type", "next", "error", "error_description", "error_code"]) {
    url.searchParams.delete(key);
  }
  const path = `${url.pathname}${url.search}`;
  window.history.replaceState({}, "", path);
}

export async function consumeAuthLink(
  client: SupabaseClient,
): Promise<{ ok: boolean; recovery: boolean; error?: string }> {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const urlError =
    url.searchParams.get("error_description") ||
    url.searchParams.get("error") ||
    hash.get("error_description") ||
    hash.get("error");
  const typeRaw = url.searchParams.get("type") || hash.get("type") || "";
  const recovery = peekPasswordResetIntent() || typeRaw === "recovery" || url.pathname.includes("/auth/reset");

  if (urlError) return { ok: false, recovery, error: urlError };

  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    stripAuthParams();
    if (error && !/already|exchange/i.test(error.message)) {
      return { ok: false, recovery, error: error.message };
    }
    return { ok: true, recovery };
  }

  const tokenHash = url.searchParams.get("token_hash");
  if (tokenHash && OTP_TYPES.has(typeRaw)) {
    const { error } = await client.auth.verifyOtp({
      token_hash: tokenHash,
      type: typeRaw as EmailOtpType,
    });
    stripAuthParams();
    if (error) return { ok: false, recovery: typeRaw === "recovery", error: error.message };
    return { ok: true, recovery: typeRaw === "recovery" || recovery };
  }

  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (accessToken && refreshToken) {
    const { error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    stripAuthParams();
    if (error) return { ok: false, recovery, error: error.message };
    return { ok: true, recovery: hash.get("type") === "recovery" || recovery };
  }

  const { data } = await client.auth.getSession();
  return { ok: Boolean(data.session), recovery };
}
