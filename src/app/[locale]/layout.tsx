import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

import { AppHeader } from "@/components/AppHeader";
import { PwaRegister } from "@/components/PwaRegister";

export const viewport: Viewport = {
  themeColor: "#FAF9F7",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const isZh = raw === "zh";
  return {
    manifest: isZh ? "/manifest.webmanifest" : "/manifest.en.webmanifest",
    appleWebApp: {
      capable: true,
      title: isZh ? "咔皮·家庭财务规划" : "Kapi · Family Finance",
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

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <PwaRegister />
      <div className="min-h-full bg-[#FAF9F7] text-foreground">
        <AppHeader />
        <main className="mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
      </div>
    </NextIntlClientProvider>
  );
}

