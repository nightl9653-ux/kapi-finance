"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

const LOCALE_PREFIX_RE = /^\/(en|zh)(?=\/|$)/;

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (newLocale: "en" | "zh") => {
    const nextPath = pathname.replace(LOCALE_PREFIX_RE, `/${newLocale}`);
    router.push(nextPath);
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => switchLocale(locale === "en" ? "zh" : "en")}
      className="rounded-full"
    >
      {locale === "en" ? "中文" : "English"}
    </Button>
  );
}
