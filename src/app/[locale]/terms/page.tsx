import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LegalDocument } from "@/components/legal/LegalDocument";
import { siteDescription } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = raw === "zh" ? "zh" : "en";
  const t = await getTranslations("legalTerms");
  return {
    title: t("title"),
    description: siteDescription(locale),
  };
}

export default async function TermsPage() {
  return <LegalDocument namespace="legalTerms" />;
}
