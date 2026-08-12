"use client";

import { useLocale, useTranslations } from "next-intl";
import { useLayoutEffect, useRef, useState } from "react";

import { useAuthContextOptional } from "@/components/auth/AuthStatus";
import { useAppleMobileDevice } from "@/lib/device";

/** 与 AuthStatus 苹果英文 ms-[14px] 对应：整体左移量扣回，避免登录离语言更远 */
const AUTH_NUDGE_PX = 14;

/** 软导航 remount 时沿用上次测得的宽度，避免第一帧 width=0 */
let cachedShiftPx = 0;

/**
 * 仅苹果英文：在登录与语言之间留空档，把铃铛、登录整体往左挪。
 * 测量在苹果中英文都做；切到英文时第一帧就用已算好的宽度。
 */
export function AppleEnControlsShift() {
  const appleMobile = useAppleMobileDevice();
  const locale = useLocale();
  const t = useTranslations("auth");
  const auth = useAuthContextOptional();
  const measureRef = useRef<HTMLSpanElement>(null);
  const [shiftPx, setShiftPx] = useState(() => cachedShiftPx);

  const signedIn = auth?.state.status === "signedIn";
  const enAuth = signedIn ? t("signOut") : t("signIn");
  const zhAuth = signedIn ? "退出登录" : "登录";
  const showSpacer = appleMobile && locale === "en";

  useLayoutEffect(() => {
    if (!appleMobile) {
      cachedShiftPx = 0;
      setShiftPx(0);
      return;
    }
    const root = measureRef.current;
    if (!root) return;
    const enLocale = root.querySelector<HTMLElement>("[data-m='en-locale']");
    const zhLocale = root.querySelector<HTMLElement>("[data-m='zh-locale']");
    const enAuthEl = root.querySelector<HTMLElement>("[data-m='en-auth']");
    const zhAuthEl = root.querySelector<HTMLElement>("[data-m='zh-auth']");
    if (!enLocale || !zhLocale || !enAuthEl || !zhAuthEl) return;

    const localeDiff = Math.max(0, enLocale.offsetWidth - zhLocale.offsetWidth);
    const authDiff = Math.max(0, zhAuthEl.offsetWidth - enAuthEl.offsetWidth);
    const next = Math.max(0, localeDiff + authDiff - AUTH_NUDGE_PX);
    cachedShiftPx = next;
    setShiftPx(next);
  }, [appleMobile, enAuth, zhAuth]);

  if (!appleMobile) return null;

  return (
    <>
      <span
        ref={measureRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 -z-50 flex gap-2 opacity-0"
      >
        <span
          data-m="en-locale"
          className="inline-flex h-8 shrink-0 items-center justify-center rounded-full border px-3 text-sm font-medium"
        >
          English
        </span>
        <span
          data-m="zh-locale"
          className="inline-flex h-8 shrink-0 items-center justify-center rounded-full border px-3 text-sm font-medium"
        >
          中文
        </span>
        <span
          data-m="en-auth"
          className="inline-flex h-8 shrink-0 items-center justify-center rounded-full border px-3 text-sm font-medium"
        >
          {enAuth}
        </span>
        <span
          data-m="zh-auth"
          className="inline-flex h-8 shrink-0 items-center justify-center rounded-full border px-3 text-sm font-medium"
        >
          {zhAuth}
        </span>
      </span>
      {showSpacer ? <span aria-hidden className="shrink-0" style={{ width: shiftPx }} /> : null}
    </>
  );
}
