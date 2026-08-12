"use client";

import { useEffect, useState } from "react";

/** Huawei / Harmony / Honor — often larger system UI scale than iPhone. */
export function isHuaweiLikeUa(ua: string): boolean {
  return /Huawei|HUAWEI|HarmonyOS|HONOR|HMOS|HMSCore/i.test(ua);
}

export function isAppleMobileUa(ua: string): boolean {
  return /iPhone|iPad|iPod/i.test(ua);
}

/** 跨软导航复用，避免 remount 时先 false 再 true 导致顶栏闪一下 */
let huaweiLikeCached: boolean | null = null;
let appleMobileCached: boolean | null = null;

export function useHuaweiLikeDevice(): boolean {
  const [match, setMatch] = useState(() => huaweiLikeCached ?? false);
  useEffect(() => {
    const next = isHuaweiLikeUa(navigator.userAgent || "");
    huaweiLikeCached = next;
    setMatch(next);
  }, []);
  return match;
}

export function useAppleMobileDevice(): boolean {
  const [match, setMatch] = useState(() => appleMobileCached ?? false);
  useEffect(() => {
    const next = isAppleMobileUa(navigator.userAgent || "");
    appleMobileCached = next;
    setMatch(next);
  }, []);
  return match;
}
