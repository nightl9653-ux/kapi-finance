import { FeatureGuestLanding } from "@/components/marketing/FeatureGuestLanding";
import { MeetingsApp } from "@/components/meetings/MeetingsApp";
import type { Locale } from "@/i18n/locales";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";

export default async function MeetingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (raw === "zh" ? "zh" : "en") as Locale;
  const nav = await getTranslations("nav");
  const fp = await getTranslations("featurePages");

  if (!isSupabaseConfigured) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">{nav("meetings")}</h1>
        <p className="text-sm text-muted-foreground">{fp("supabaseMissing")}</p>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return (
      <FeatureGuestLanding locale={locale} feature="meetings" signInNext={`/${locale}/meetings`} />
    );
  }

  return <MeetingsApp userId={auth.user.id} />;
}
