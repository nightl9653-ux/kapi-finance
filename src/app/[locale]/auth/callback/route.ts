import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";

import { isSafeInternalNextPath } from "@/lib/auth-return-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ locale: string }> },
) {
  const { locale } = await context.params;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextRaw = url.searchParams.get("next") ?? `/${locale}`;
  let next = nextRaw;
  try {
    next = decodeURIComponent(nextRaw);
  } catch {
    next = `/${locale}`;
  }
  if (!isSafeInternalNextPath(next)) {
    next = `/${locale}`;
  }

  if (!code) {
    redirect(`/${locale}/auth`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    redirect(`/${locale}/auth`);
  }

  return NextResponse.redirect(new URL(next, url.origin));
}

