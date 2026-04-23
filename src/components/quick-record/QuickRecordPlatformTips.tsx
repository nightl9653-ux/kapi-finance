"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

function detectPlatform(): "ios" | "android" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
    return "ios";
  }
  if (/Android/i.test(ua)) return "android";
  return "other";
}

export function QuickRecordPlatformTips({ locale }: { locale: string }) {
  const t = useTranslations("quickRecord");
  const platform = useMemo(() => detectPlatform(), []);
  const quickUrl = `/${locale}/quick-record?autoPaste=1`;

  const shortcutHref = process.env.NEXT_PUBLIC_IOS_SHORTCUTS_URL?.trim();
  const showIos = platform === "ios" || platform === "other";
  const showAndroid = platform === "android" || platform === "other";

  return (
    <div className="space-y-3">
      {showIos && (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/90 p-4 text-sm">
          <p className="font-semibold text-amber-950">{t("iosOfficialBadge")}</p>
          <p className="mt-2 text-amber-900/90">{t("iosOfficialBody")}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-amber-900/85">
            <li>{t("iosStep1")}</li>
            <li>{t("iosStep2", { url: quickUrl })}</li>
            <li>{t("iosStep3")}</li>
          </ol>
          {shortcutHref ? (
            <a
              href={shortcutHref}
              className="mt-3 inline-block text-sm font-medium text-amber-950 underline underline-offset-4"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("iosShortcutInstall")}
            </a>
          ) : (
            <p className="mt-2 text-xs text-amber-800/80">{t("iosShortcutPlaceholder")}</p>
          )}
        </div>
      )}

      {showAndroid && (
        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/80 p-4 text-sm text-emerald-950">
          <p className="font-semibold">{t("androidOfficialBadge")}</p>
          <p className="mt-2 text-emerald-900/90">{t("androidOfficialBody")}</p>
        </div>
      )}
    </div>
  );
}
