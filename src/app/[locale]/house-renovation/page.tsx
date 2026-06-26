import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { FeatureGuestLanding } from "@/components/marketing/FeatureGuestLanding";
import { buttonVariants } from "@/components/ui/button";
import type { Locale } from "@/i18n/locales";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function HouseRenovationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (raw === "zh" ? "zh" : "en") as Locale;
  const nav = await getTranslations("nav");
  const t = await getTranslations("featurePages");

  if (!isSupabaseConfigured) {
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
      <FeatureGuestLanding locale={locale} feature="houseRenovation" signInNext={`/${locale}/house-renovation`} />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{nav("houseRenovation")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("houseRenovation.lead")}</p>
      </div>
      <div className="rounded-2xl border bg-white p-6">
        <p className="text-sm text-muted-foreground">{t("comingSoon")}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href={`/${locale}/goals`} className={cn(buttonVariants({ className: "rounded-full" }))}>
            {t("goToGoals")}
          </Link>
          <Link
            href={`/${locale}/transactions`}
            className={cn(buttonVariants({ variant: "outline", className: "rounded-full" }))}
          >
            {t("goToTransactions")}
          </Link>
        </div>
      </div>
    </div>
  );
}
