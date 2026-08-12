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
        // 苹果：占位宽度始终按 “English”，英文模式下「中文」不缩窄，铃铛/登录与中文模式对齐；右缘仍贴右
        appleMobile && "min-w-[4.75rem] justify-center",
      )}
    >
      {/* 用不可见 “English” 锁宽，避免仅靠 min-w 估不准 */}
      {appleMobile ? (
        <span className="inline-grid justify-items-center">
          <span className="invisible col-start-1 row-start-1 pointer-events-none select-none" aria-hidden>
            English
          </span>
          <span className="col-start-1 row-start-1">{label}</span>
        </span>
      ) : (
        label
      )}
    </Button>
  );
}
