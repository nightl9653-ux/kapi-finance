import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { SUPPORT_EMAIL } from "@/lib/site";

export async function AppFooter({ locale }: { locale: "zh" | "en" }) {
  const t = await getTranslations("footer");

  return (
    <footer className="mt-auto border-t bg-[#FAF9F7]/90">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="max-w-md">{t("tagline")}</p>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href={`/${locale}/privacy`} className="hover:text-foreground">
            {t("privacy")}
          </Link>
          <Link href={`/${locale}/terms`} className="hover:text-foreground">
            {t("terms")}
          </Link>
          <Link href={`/${locale}/pricing`} className="hover:text-foreground">
            {t("pricing")}
          </Link>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-foreground hover:underline">
            {SUPPORT_EMAIL}
          </a>
        </nav>
        <p className="w-full text-xs sm:w-auto">{t("copyright", { year: new Date().getFullYear() })}</p>
      </div>
    </footer>
  );
}
