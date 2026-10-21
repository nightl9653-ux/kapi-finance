import { redirect } from "next/navigation";

import { TravelGate } from "@/components/travel/TravelGate";
import type { Locale } from "@/i18n/locales";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function TravelStudioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (raw === "zh" ? "zh" : "en") as Locale;

  if (!isSupabaseConfigured) {
    redirect(`/${locale}/travel`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    redirect(`/${locale}/travel`);
  }

  return <TravelGate userId={auth.user.id} />;
}
