import type { NextRequest } from "next/server";

import { isAllowedDressupOrigin } from "@/lib/dressup-origins";
import { dressupPlusPingHtml, dressupUnlockHtmlResponse } from "@/lib/dressup-unlock-html";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchUserIsPlusMember } from "@/lib/user-plus-membership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.searchParams.get("origin")?.trim() ?? "";
  if (!isAllowedDressupOrigin(origin)) {
    return new Response(null, { status: 400 });
  }

  const headers = {
    "content-security-policy": `frame-ancestors ${origin}`,
  };

  function ping(status: "plus" | "not-plus" | "unknown", extra?: { plus?: boolean; reason?: string }) {
    return dressupUnlockHtmlResponse(
      dressupPlusPingHtml({ targetOrigin: origin, status, ...extra }),
    );
  }

  if (!isSupabaseConfigured) {
    const res = ping("unknown", { reason: "not_configured" });
    for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
    return res;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      const res = ping("unknown", { reason: "not_logged_in" });
      for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
      return res;
    }
    const plus = await fetchUserIsPlusMember(supabase, auth.user.id);
    const res = ping(plus ? "plus" : "not-plus", { plus });
    for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
    return res;
  } catch {
    const res = ping("unknown", { reason: "error" });
    for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
    return res;
  }
}
