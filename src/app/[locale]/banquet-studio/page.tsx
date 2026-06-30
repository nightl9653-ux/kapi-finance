import { redirect } from "next/navigation";

import { BanquetPartyGate } from "@/components/banquet-party/BanquetPartyGate";
import type { Locale } from "@/i18n/locales";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function BanquetStudioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (raw === "zh" ? "zh" : "en") as Locale;

  if (!isSupabaseConfigured) {
    redirect(`/${locale}/banquet-party`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    redirect(`/${locale}/banquet-party`);
  }

  return <BanquetPartyGate userId={auth.user.id} />;
}
