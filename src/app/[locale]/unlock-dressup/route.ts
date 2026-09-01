import { NextResponse, type NextRequest } from "next/server";

import { isSafeInternalNextPath } from "@/lib/auth-return-path";
import { isAllowedDressupOrigin } from "@/lib/dressup-origins";
import {
  dressupUnlockBounceHtml,
  dressupUnlockErrorHtml,
  dressupUnlockHtmlResponse,
  dressupUnlockNeedPlusHtml,
  dressupUnlockStayHtml,
} from "@/lib/dressup-unlock-html";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchUserIsPlusMember } from "@/lib/user-plus-membership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function localeFromParam(raw: string): "zh" | "en" {
  return raw === "zh" ? "zh" : "en";
}

function allowedReturnUrl(raw: string | null): URL | null {
  const value = raw?.trim() ?? "";
  if (!value) return null;
  try {
    const url = new URL(value);
    return isAllowedDressupOrigin(url.origin) ? url : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await context.params;
  const locale = localeFromParam(raw);
  const originParam = request.nextUrl.searchParams.get("origin")?.trim() ?? "";
  const dressupOrigin = isAllowedDressupOrigin(originParam) ? originParam : "";
  const returnUrl =
    allowedReturnUrl(request.nextUrl.searchParams.get("return")) ??
    (dressupOrigin ? new URL(`${dressupOrigin}/`) : null);

  if (!isSupabaseConfigured) {
    return dressupUnlockHtmlResponse(dressupUnlockErrorHtml(locale), 503);
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    const safeNext = isSafeInternalNextPath(next) ? next : `/${locale}/unlock-dressup`;
    return NextResponse.redirect(new URL(`/${locale}/auth?next=${encodeURIComponent(safeNext)}`, request.url));
  }

  try {
    const plus = await fetchUserIsPlusMember(supabase, auth.user.id);
    if (!plus) {
      return dressupUnlockHtmlResponse(dressupUnlockNeedPlusHtml(locale, `/${locale}/pricing`));
    }
    const bounceOrigin = dressupOrigin || returnUrl?.origin || "";
    if (!returnUrl || !bounceOrigin) {
      return dressupUnlockHtmlResponse(dressupUnlockStayHtml(locale));
    }
    return dressupUnlockHtmlResponse(
      dressupUnlockBounceHtml({
        locale,
        dressupOrigin: bounceOrigin,
        returnUrl: returnUrl.toString(),
      }),
    );
  } catch {
    return dressupUnlockHtmlResponse(dressupUnlockErrorHtml(locale), 500);
  }
}
