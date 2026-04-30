import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import type { Locale } from "@/i18n/locales";
import { transactionsAuthReturnPath } from "@/lib/auth-return-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createTransactionsBulk } from "@/lib/server-actions/create-transactions-bulk";
import { CsvImportClient } from "@/components/transactions/CsvImportClient";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function TransactionsImportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (raw === "zh" ? "zh" : "en") as Locale;
  const t = await getTranslations("transactionsImport");

  if (!isSupabaseConfigured) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("supabaseMissing")}</p>
        </div>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    const returnTo = transactionsAuthReturnPath(locale, {});
    redirect(`/${locale}/auth?next=${encodeURIComponent(returnTo)}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Link href={`/${locale}/transactions`} className={cn(buttonVariants({ variant: "outline" }))}>
          {t("backToTransactions")}
        </Link>
      </div>

      <CsvImportClient locale={locale} action={createTransactionsBulk} />
    </div>
  );
}

