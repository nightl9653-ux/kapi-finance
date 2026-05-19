import { NextResponse } from "next/server";

import { appendPackCheckoutMetadata } from "@/lib/billing-checkout-url";
import { CREDIT_PACK_IDS, CREDIT_PACKS, getCreditPackCheckoutUrl } from "@/lib/credit-packs";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchUserIsPlusMember } from "@/lib/user-plus-membership";

export async function GET() {
  const packs = CREDIT_PACK_IDS.map((id) => {
    const def = CREDIT_PACKS[id];
    return {
      id: def.id,
      price_usd: def.displayPriceUsd,
      standard_images: def.standardImages,
      hq_images: def.hqImages,
      valid_days: def.validDays,
      checkout_configured: Boolean(getCreditPackCheckoutUrl(def)),
    };
  });

  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: true, tier: null, packs, checkout_urls: {} });
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: true, tier: null, packs, checkout_urls: {} });
  }

  const isPlus = await fetchUserIsPlusMember(supabase, auth.user.id);
  const checkout_urls: Partial<Record<string, string>> = {};
  if (isPlus) {
    for (const id of CREDIT_PACK_IDS) {
      const def = CREDIT_PACKS[id];
      const base = getCreditPackCheckoutUrl(def);
      if (base) checkout_urls[id] = appendPackCheckoutMetadata(base, auth.user.id, id);
    }
  }

  return NextResponse.json({
    ok: true,
    tier: isPlus ? "plus" : "free",
    packs,
    checkout_urls,
  });
}
