import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { authResetPath } from "@/lib/auth-return-path";
import { env } from "@/lib/env";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ locale: string }> },
) {
  const { locale } = await context.params;
  const url = new URL(request.url);
  const resetUrl = new URL(authResetPath(locale), url.origin);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const code = url.searchParams.get("code");

  let response = NextResponse.redirect(resetUrl);

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  let error: { message: string } | null = null;
  if (tokenHash && (type === "recovery" || !type)) {
    const result = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });
    error = result.error;
  } else if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    error = result.error;
  } else {
    const failed = new URL(resetUrl);
    failed.searchParams.set("invalid", "1");
    return NextResponse.redirect(failed);
  }

  if (error) {
    const failed = new URL(resetUrl);
    failed.searchParams.set("invalid", "1");
    return NextResponse.redirect(failed);
  }

  return response;
}
