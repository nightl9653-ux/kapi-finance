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
      className={cn(
        "rounded-full",
        // 按 English 占宽，只显示当前文案（避免隐形叠字在 Safari 上花屏）
        appleMobile && "min-w-[4.75rem] justify-center",
      )}
    >
      {label}
    </Button>
  );
}
