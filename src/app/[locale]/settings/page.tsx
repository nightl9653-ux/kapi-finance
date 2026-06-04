import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { FeatureGuestLanding } from "@/components/marketing/FeatureGuestLanding";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/locales";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (raw === "zh" ? "zh" : "en") as Locale;
  const nav = await getTranslations("nav");
  const t = await getTranslations("transactions");
  const s = await getTranslations("settingsPage");
  const qr = await getTranslations("quickRecord");

  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      return (
        <FeatureGuestLanding
          locale={locale}
          feature="settings"
          signInNext={`/${locale}/settings`}
        />
      );
    }
  } else {
    return (
      <FeatureGuestLanding locale={locale} feature="settings" signInNext={`/${locale}/settings`} />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{nav("settings")}</h1>
        <p className="text-sm text-muted-foreground">{s("intro")}</p>
      </div>

      <div className="rounded-2xl border bg-white/70 p-6">
        <h2 className="text-base font-semibold">{s("quickRecordTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{s("quickRecordBody")}</p>
        <p className="mt-2 text-sm text-amber-900/85">{s("iosPitch")}</p>
        <p className="mt-2 text-xs text-muted-foreground">{s("installPwaHint")}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href={`/${locale}/quick-record`} className={cn(buttonVariants(), "rounded-full")}>
            {s("openQuickRecord")}
          </Link>
          <Link href={`/${locale}/recurring-bills`} className={cn(buttonVariants({ variant: "secondary" }), "rounded-full")}>
            {t("recurringManageTitle")}
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed bg-white/40 p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{qr("title")}</p>
        <p className="mt-1">{qr("subtitle")}</p>
      </div>
    </div>
  );
}
