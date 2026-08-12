"use client";

import { useEffect, useState } from "react";

/** Huawei / Harmony / Honor — often larger system UI scale than iPhone. */
export function isHuaweiLikeUa(ua: string): boolean {
  return /Huawei|HUAWEI|HarmonyOS|HONOR|HMOS|HMSCore/i.test(ua);
}

export function isAppleMobileUa(ua: string): boolean {
  return /iPhone|iPad|iPod/i.test(ua);
}

export function useHuaweiLikeDevice(): boolean {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    setMatch(isHuaweiLikeUa(navigator.userAgent || ""));
  }, []);
  return match;
}

export function useAppleMobileDevice(): boolean {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    setMatch(isAppleMobileUa(navigator.userAgent || ""));
  }, []);
  return match;
}
