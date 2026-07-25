import { redirect } from "next/navigation";

import { RenovationGate } from "@/components/house-renovation/RenovationGate";
import type { Locale } from "@/i18n/locales";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function RenovationStudioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (raw === "zh" ? "zh" : "en") as Locale;

  if (!isSupabaseConfigured) {
    redirect(`/${locale}/house-renovation`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    redirect(`/${locale}/house-renovation`);
  }

  return <RenovationGate userId={auth.user.id} />;
}
