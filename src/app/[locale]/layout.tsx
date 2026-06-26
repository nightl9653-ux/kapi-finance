import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

import { LegalConsentRecorder } from "@/components/auth/LegalConsentRecorder";
import { AppFooter } from "@/components/AppFooter";
import { AppHeader } from "@/components/AppHeader";
import { PwaRegister } from "@/components/PwaRegister";
import { isSupabaseConfigured } from "@/lib/env";
import { getSiteUrl, siteDescription, siteName } from "@/lib/site";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const viewport: Viewport = {
  themeColor: "#FAF9F7",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = raw === "zh" ? "zh" : "en";
  const name = siteName(locale);
  const description = siteDescription(locale);
  const siteUrl = getSiteUrl();
  return {
    title: {
      default: name,
      template: locale === "zh" ? "%s · 咔账" : "%s · Kash",
    },
    description,
    metadataBase: siteUrl ? new URL(siteUrl) : undefined,
    openGraph: {
      title: name,
      description,
      siteName: name,
      locale: locale === "zh" ? "zh_CN" : "en_US",
      type: "website",
    },
    manifest: locale === "zh" ? "/manifest.webmanifest" : "/manifest.en.webmanifest",
    appleWebApp: {
      capable: true,
      title: name,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw === "zh" ? "zh" : "en";
  const messages = await getMessages();

  let initialAuth: { email: string | null } | null = null;
  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      initialAuth = { email: data.user.email ?? null };
    }
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <PwaRegister />
      <LegalConsentRecorder />
      <div className="flex min-h-full flex-col bg-[#FAF9F7] text-foreground">
        <AppHeader initialAuth={initialAuth} />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
        <AppFooter locale={locale} />
      </div>
    </NextIntlClientProvider>
  );
}

