import { createServerClient } from "@supabase/ssr";
import createIntlProxy from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { isSafeInternalNextPath } from "@/lib/auth-return-path";
import { env, isSupabaseConfigured } from "@/lib/env";

const intlProxy = createIntlProxy({
  locales: ["en", "zh"],
  defaultLocale: "en",
  localePrefix: "always",
});

const PUBLIC_PATHS = new Set(["/auth", "/pricing"]);

function getLocaleFromPathname(pathname: string): "en" | "zh" | null {
  if (pathname === "/en" || pathname.startsWith("/en/")) return "en";
  if (pathname === "/zh" || pathname.startsWith("/zh/")) return "zh";
  return null;
}

function isPublicPath(pathname: string, locale: "en" | "zh") {
  const rest = pathname === `/${locale}` ? "/" : pathname.slice(`/${locale}`.length);
  for (const p of PUBLIC_PATHS) {
    if (rest === p || rest.startsWith(`${p}/`)) return true;
  }
  return false;
}

export default async function proxy(request: NextRequest) {
  const intlResponse = intlProxy(request);

  // Debug helper (opt-in) to inspect intl proxy decisions.
  // Example: /zh/auth?__debugProxy=1
  if (request.nextUrl.searchParams.get("__debugProxy") === "1") {
    return NextResponse.json({
      pathname: request.nextUrl.pathname,
      search: request.nextUrl.search,
      location: intlResponse.headers.get("location"),
      rewrite: intlResponse.headers.get("x-middleware-rewrite"),
    });
  }

  // If intl already issued a redirect/rewrite, let it happen first.
  const location = intlResponse.headers.get("location");
  if (location) return intlResponse;

  const { pathname, search } = request.nextUrl;
  const locale = getLocaleFromPathname(pathname);
  if (!locale) return intlResponse;

  if (!isSupabaseConfigured) {
    return intlResponse;
  }

  if (isPublicPath(pathname, locale)) {
    // Hide auth page by default after sign-in (allow override for debugging).
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
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};

