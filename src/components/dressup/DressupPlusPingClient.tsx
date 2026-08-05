"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { dressupOriginAlternates, isAllowedDressupOrigin } from "@/lib/dressup-origins";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchUserIsPlusMember } from "@/lib/user-plus-membership";

function postStatus(targetOrigin: string, body: Record<string, unknown>) {
  const payload = { source: "kapi-finance", type: "dressup-plus-status", ...body };
  for (const origin of dressupOriginAlternates(targetOrigin)) {
    try {
      window.parent.postMessage(payload, origin);
    } catch {
      // ignore
    }
  }
}

/** 供宅宴隐藏 iframe 静默核对 Plus；无 UI */
export function DressupPlusPingClient() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const origin = searchParams.get("origin")?.trim() ?? "";
    if (!isAllowedDressupOrigin(origin)) return;

    let cancelled = false;

    async function run() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: auth } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!auth.user) {
          postStatus(origin, { status: "unknown", reason: "not_logged_in" });
          return;
        }
        const plus = await fetchUserIsPlusMember(supabase, auth.user.id);
        if (cancelled) return;
        postStatus(origin, { status: plus ? "plus" : "not-plus", plus });
      } catch {
        if (!cancelled) postStatus(origin, { status: "unknown", reason: "error" });
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return null;
}
