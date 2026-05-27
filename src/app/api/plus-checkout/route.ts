import { NextResponse } from "next/server";

import { appendPlusCheckoutMetadata } from "@/lib/billing-checkout-url";
import { isSupabaseConfigured } from "@/lib/env";
import { PLUS_PLAN_IDS, PLUS_PLANS, getPlusPlanCheckoutUrl } from "@/lib/plus-plans";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchUserIsPlusMember } from "@/lib/user-plus-membership";

export async function GET() {
  const plans = PLUS_PLAN_IDS.map((id) => {
    const def = PLUS_PLANS[id];
    return {
      id: def.id,
      checkout_configured: Boolean(getPlusPlanCheckoutUrl(def)),
    };
  });

  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: true, tier: null, plans, checkout_urls: {} });
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: true, tier: null, plans, checkout_urls: {} });
  }

  const isPlus = await fetchUserIsPlusMember(supabase, auth.user.id);
  const checkout_urls: Partial<Record<string, string>> = {};

  if (!isPlus) {
    for (const id of PLUS_PLAN_IDS) {
      const def = PLUS_PLANS[id];
      const base = getPlusPlanCheckoutUrl(def);
      if (base) checkout_urls[id] = appendPlusCheckoutMetadata(base, auth.user.id, id);
    }
  }

  return NextResponse.json({
    ok: true,
    tier: isPlus ? "plus" : "free",
    plans,
    checkout_urls,
  });
}
