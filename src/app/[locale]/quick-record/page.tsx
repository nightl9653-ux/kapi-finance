import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import type { Locale } from "@/i18n/locales";
import { QuickRecordClient } from "@/components/quick-record/QuickRecordClient";
import { ClearFlashParams } from "@/components/transactions/ClearFlashParams";
import { isSupabaseConfigured, scanReceiptDailyLimit } from "@/lib/env";
import { createTransactionsBulk } from "@/lib/server-actions/create-transactions-bulk";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function QuickRecordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (raw === "zh" ? "zh" : "en") as Locale;

  if (!isSupabaseConfigured) {
    const t = await getTranslations("quickRecord");
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("supabaseMissing")}</p>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    redirect(`/${locale}/auth?next=${encodeURIComponent(`/${locale}/quick-record`)}`);
  }

  const t = await getTranslations("quickRecord");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("pageSubtitle")}</p>
      </div>

      <Suspense fallback={<div className="text-sm text-muted-foreground">{t("loading")}</div>}>
        <ClearFlashParams />
        <QuickRecordClient locale={locale} action={createTransactionsBulk} scanDailyLimit={scanReceiptDailyLimit} />
      </Suspense>
    </div>
  );
}
