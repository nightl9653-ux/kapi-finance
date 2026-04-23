"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

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
  const supabase = useMemo(() => (isSupabaseConfigured ? createSupabaseBrowserClient() : null), []);
  const [unread, setUnread] = useState<number>(0);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    const client = supabase;
    let cancelled = false;

    async function run() {
      // 1) 确保“昨日未记账”通知被生成（幂等）
      await fetch("/api/notifications/ensure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          // fallback for older servers
          today: getLocalISODate(),
        }),
      }).catch(() => null);

      // 2) 拉取未读数量（右上角角标）
      const { count } = await client
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);

      if (!cancelled) setUnread(count ?? 0);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  if (!isSupabaseConfigured) return null;

  return (
    <Link
      href={`/${locale}/notifications`}
      className="relative inline-flex h-9 items-center rounded-full border bg-white/70 px-3 text-sm text-muted-foreground hover:text-foreground"
    >
      {t("label")}
      {unread > 0 ? (
        <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-xs font-medium text-background">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}

