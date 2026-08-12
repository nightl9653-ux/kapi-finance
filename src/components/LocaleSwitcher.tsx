"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useAppleMobileDevice } from "@/lib/device";
import { cn } from "@/lib/utils";

const LOCALE_PREFIX_RE = /^\/(en|zh)(?=\/|$)/;

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const appleMobile = useAppleMobileDevice();

  const switchLocale = (newLocale: "en" | "zh") => {
    const nextPath = pathname.replace(LOCALE_PREFIX_RE, `/${newLocale}`);
    router.push(nextPath);
  };

  const label = locale === "en" ? "中文" : "English";

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => switchLocale(locale === "en" ? "zh" : "en")}
      className={cn("rounded-full", appleMobile && "relative")}
    >
      {appleMobile ? (
        <>
          {/* 固定为较宽的 English，切语言时右缘与铃铛位置都不变 */}
          <span className="invisible" aria-hidden>
            English
          </span>
          <span className="absolute inset-0 flex items-center justify-center">{label}</span>
        </>
      ) : (
        label
      )}
    </Button>
  );
}
