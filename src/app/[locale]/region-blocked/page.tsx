import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function RegionBlockedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw === "zh" ? "zh" : "en";
  const t = await getTranslations("regionBlocked");

  return (
    <div className="mx-auto max-w-lg space-y-6 rounded-3xl border bg-white/70 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">{t("body")}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">{t("noLiability")}</p>
      <p className="text-xs text-muted-foreground">{t("contact")}</p>
      <Link
        href={`/${locale}/terms`}
        className="inline-block text-sm font-medium text-foreground underline underline-offset-4"
      >
        {t("readTerms")}
      </Link>
    </div>
  );
}
