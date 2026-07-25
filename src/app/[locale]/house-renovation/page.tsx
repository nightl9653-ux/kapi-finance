import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { FeatureGuestLanding } from "@/components/marketing/FeatureGuestLanding";
import type { Locale } from "@/i18n/locales";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function HouseRenovationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (raw === "zh" ? "zh" : "en") as Locale;
  const nav = await getTranslations("nav");

  if (!isSupabaseConfigured) {
    const t = await getTranslations("featurePages");
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">{nav("houseRenovation")}</h1>
        <p className="text-sm text-muted-foreground">{t("supabaseMissing")}</p>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return (
      <FeatureGuestLanding
        locale={locale}
        feature="houseRenovation"
        signInNext={`/${locale}/renovation-studio`}
      />
    );
  }

  redirect(`/${locale}/renovation-studio`);
}
