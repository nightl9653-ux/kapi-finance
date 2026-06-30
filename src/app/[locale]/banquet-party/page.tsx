import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { FeatureGuestLanding } from "@/components/marketing/FeatureGuestLanding";
import type { Locale } from "@/i18n/locales";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function BanquetPartyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (raw === "zh" ? "zh" : "en") as Locale;
  const nav = await getTranslations("nav");
  const t = await getTranslations("featurePages");

  if (!isSupabaseConfigured) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">{nav("banquetParty")}</h1>
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
        feature="banquetParty"
        signInNext={`/${locale}/banquet-studio`}
      />
    );
  }

  redirect(`/${locale}/banquet-studio`);
}
