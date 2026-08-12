"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { useAppleMobileDevice } from "@/lib/device";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

function getLocalISODate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function NotificationsEntry() {
  const locale = useLocale();
  const t = useTranslations("notifications");
  const appleMobile = useAppleMobileDevice();
  // 仅苹果中文：铃铛略左移；英文/华为布局不动
  const appleZhBellNudge = appleMobile && locale === "zh";
  const supabase = useMemo(() => (isSupabaseConfigured ? createSupabaseBrowserClient() : null), []);
  const [unread, setUnread] = useState<number>(0);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    const client = supabase;
    let cancelled = false;

    const ac = new AbortController();

    async function run() {
      try {
        await fetch("/api/notifications/ensure", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            today: getLocalISODate(),
          }),
          signal: ac.signal,
        }).catch((e) => {
          if ((e as Error).name === "AbortError") return null;
          return null;
        });

        const { count, error } = await client
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .is("read_at", null);

        if (error || cancelled) return;
        setUnread(count ?? 0);
      } catch {
        // ignore
      }
    }

    void run();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [supabase]);

  if (!isSupabaseConfigured) return null;

  return (
    <Link
      href={`/${locale}/notifications`}
      aria-label={t("label")}
      title={t("label")}
      className={cn(
        "relative inline-flex h-9 shrink-0 items-center justify-center rounded-full border bg-white/70 text-muted-foreground hover:text-foreground max-md:w-9 max-md:px-0 md:px-3 md:text-sm",
        appleZhBellNudge && "-translate-x-2",
      )}
    >
      {/* 手机顶栏用图标，避免英文 Notifications 过长；桌面仍显示文字 */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        className="md:hidden"
      >
        <path
          d="M6 9a6 6 0 1 1 12 0c0 3.2.8 4.6 1.5 5.5.3.4 0 1-.5 1H5c-.5 0-.8-.6-.5-1C5.2 13.6 6 12.2 6 9Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M10 18a2 2 0 0 0 4 0"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      <span className="hidden md:inline">{t("label")}</span>
      {unread > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-medium leading-4 text-background md:static md:ml-2 md:min-w-5 md:px-1.5 md:text-xs md:leading-none">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
