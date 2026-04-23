"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type UsageResponse = {
  ok?: boolean;
  scan?: { remaining?: number };
  voice?: { remaining?: number };
};

export function useAiUsage({
  getUsageDate,
  includeVoice,
  debounceMs = 5000,
  autoRefresh = true,
}: {
  getUsageDate: () => string;
  includeVoice: boolean;
  debounceMs?: number;
  autoRefresh?: boolean;
}) {
  const [scanRemaining, setScanRemaining] = useState<number | null>(null);
  const [voiceRemaining, setVoiceRemaining] = useState<number | null>(null);

  const getUsageDateRef = useRef(getUsageDate);
  useLayoutEffect(() => {
    getUsageDateRef.current = getUsageDate;
  }, [getUsageDate]);

  const fetchRef = useRef<{
    usageDate: string;
    at: number;
    p: Promise<void> | null;
  } | null>(null);

  const refreshUsage = useCallback(async () => {
    try {
      const usageDate = getUsageDateRef.current();
      const now = Date.now();
      const hit = fetchRef.current;
      if (hit && hit.usageDate === usageDate && now - hit.at < debounceMs && hit.p) {
        await hit.p;
        return;
      }

      const p = (async () => {
        const res = await fetch(`/api/ai-usage?usage_date=${encodeURIComponent(usageDate)}`);
        const data = (await res.json().catch(() => ({}))) as UsageResponse;
        if (!res.ok || !data.ok) return;
        if (typeof data.scan?.remaining === "number") setScanRemaining(data.scan.remaining);
        if (includeVoice && typeof data.voice?.remaining === "number") setVoiceRemaining(data.voice.remaining);
      })();

      fetchRef.current = { usageDate, at: now, p };
      await p;
    } catch {
      // ignore
    }
  }, [debounceMs, includeVoice]);

  useEffect(() => {
    if (!autoRefresh) return;
    void refreshUsage();
  }, [autoRefresh, refreshUsage]);

  return {
    scanRemaining,
    voiceRemaining,
    setScanRemaining,
    setVoiceRemaining,
    refreshUsage,
  };
}

