import { createServerClient } from "@supabase/ssr";
import createIntlProxy from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { isSafeInternalNextPath } from "@/lib/auth-return-path";
import { env, isSupabaseConfigured } from "@/lib/env";
import { shouldBlockRequest } from "@/lib/restricted-regions";

const intlProxy = createIntlProxy({
  locales: ["en", "zh"],
  defaultLocale: "en",
  localePrefix: "always",
});

/** Paths reachable without sign-in (marketing, legal, checkout info). */
const PUBLIC_PATHS = new Set([
  "/",
  "/auth",
  "/pricing",
  "/privacy",
  "/terms",
  "/goals",
  "/transactions",
  "/quick-record",
  "/house-renovation",
  "/meetings",
  "/ai-assistant",
  "/reports",
  "/settings",
  "/region-blocked",
]);

function getLocaleFromPathname(pathname: string): "en" | "zh" | null {
  if (pathname === "/en" || pathname.startsWith("/en/")) return "en";
  if (pathname === "/zh" || pathname.startsWith("/zh/")) return "zh";
  return null;
}

function isRegionBlockedPage(pathname: string, locale: "en" | "zh") {
  return pathname === `/${locale}/region-blocked`;
}

function isPublicPath(pathname: string, locale: "en" | "zh") {
  const rest = pathname === `/${locale}` ? "/" : pathname.slice(`/${locale}`.length);
  // Landing only — /banquet-studio and /renovation-studio require sign-in
  if (rest === "/banquet-party") return true;
  if (rest === "/house-renovation") return true;
  for (const p of PUBLIC_PATHS) {
    if (rest === p || rest.startsWith(`${p}/`)) return true;
  }
  return false;
}

function geoBlockResponse(request: NextRequest, locale: "en" | "zh" | null) {
  const loc = locale ?? "en";
  if (request.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.json({ ok: false, error: "region_blocked" }, { status: 451 });
  }
  return NextResponse.redirect(new URL(`/${loc}/region-blocked`, request.url));
}

export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api")) {
    const { block } = shouldBlockRequest(request);
    if (block) return geoBlockResponse(request, null);
    return NextResponse.next();
  }

  const intlResponse = intlProxy(request);

  if (request.nextUrl.searchParams.get("__debugProxy") === "1") {
    return NextResponse.json({
      pathname: request.nextUrl.pathname,
      search: request.nextUrl.search,
      location: intlResponse.headers.get("location"),
      rewrite: intlResponse.headers.get("x-middleware-rewrite"),
      country: request.headers.get("x-vercel-ip-country") ?? request.headers.get("cf-ipcountry"),
    });
  }

  const location = intlResponse.headers.get("location");
  if (location) return intlResponse;

  const locale = getLocaleFromPathname(pathname);
  if (!locale) return intlResponse;

  const { block } = shouldBlockRequest(request);
  if (block && !isRegionBlockedPage(pathname, locale)) {
    return geoBlockResponse(request, locale);
  }

  if (!isSupabaseConfigured) {
    return intlResponse;
  }

  if (isPublicPath(pathname, locale)) {
    if (pathname === `/${locale}/auth`) {
      const force = request.nextUrl.searchParams.get("force") === "1";
      if (!force) {
        const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => intlResponse.cookies.set(name, value, options));
            },
          },
        });

        const { data } = await supabase.auth.getUser();
        if (data.user) {
          const raw = request.nextUrl.searchParams.get("next");
          let next = raw ?? `/${locale}`;
          try {
            if (raw) next = decodeURIComponent(raw);
          } catch {
            next = `/${locale}`;
          }
          const redirectTarget = isSafeInternalNextPath(next) ? next : `/${locale}`;
          return NextResponse.redirect(new URL(redirectTarget, request.url));
        }
      }
    }
    return intlResponse;
  }

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => intlResponse.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  if (data.user) return intlResponse;

  const next = `${pathname}${search}`;
  const redirectTo = `/${locale}/auth?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(new URL(redirectTo, request.url));
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
