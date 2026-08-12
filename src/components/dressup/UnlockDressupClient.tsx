"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";

import { dressupOriginAlternates, isAllowedDressupOrigin } from "@/lib/dressup-origins";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchUserIsPlusMember } from "@/lib/user-plus-membership";

function notifyOpener(dressupOrigin: string) {
  const payload = {
    source: "kapi-finance",
    type: "dressup-plus",
    plus: true,
    at: Date.now(),
  };
  if (!window.opener || !dressupOrigin) return false;
  try {
    for (const target of dressupOriginAlternates(dressupOrigin)) {
      window.opener.postMessage(payload, target);
    }
    return true;
  } catch {
    return false;
  }
}

function copy(locale: string) {
  const en = locale === "en";
  return {
    checking: en ? "Confirming Kash membership…" : "正在确认咔账会员…",
    needPlus: en
      ? "This account is not Plus yet. Subscribe to unlock full Manor."
      : "当前账号还不是 Plus 会员，开通后即可解锁完整宅宴。",
    returning: en ? "Plus confirmed — returning to Manor…" : "已确认 Plus，正在返回宅宴并解锁…",
    doneStay: en
      ? "You are Plus. Close this tab and return to Manor; unlock again if needed."
      : "已是 Plus。请关闭本页，回到宅宴；若未解锁请再点一次确认解锁。",
    error: en ? "Could not confirm membership. Try again later." : "确认会员失败，请稍后重试。",
    goPlus: en ? "Get Plus" : "去开通 Plus",
    openPricing: en ? "Open pricing" : "打开会员页",
  };
}

export function UnlockDressupClient() {
  const locale = useLocale();
  const searchParams = useSearchParams();
  const ui = useMemo(() => copy(locale), [locale]);
  const [status, setStatus] = useState<"checking" | "need-plus" | "done" | "error">("checking");
  const [detail, setDetail] = useState(ui.checking);

  const dressupOrigin = useMemo(() => {
    const raw = searchParams.get("origin")?.trim() ?? "";
    return isAllowedDressupOrigin(raw) ? raw : "";
  }, [searchParams]);

  const returnUrl = useMemo(() => {
    const raw = searchParams.get("return")?.trim() ?? "";
    if (!raw) return dressupOrigin ? `${dressupOrigin}/` : "";
    try {
      const u = new URL(raw);
      if (!isAllowedDressupOrigin(u.origin)) return "";
      return u.toString();
    } catch {
      return "";
    }
  }, [searchParams, dressupOrigin]);

  useEffect(() => {
    setDetail(ui.checking);
  }, [ui.checking]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) {
          const next = `/${locale}/unlock-dressup?${searchParams.toString()}`;
          window.location.replace(`/${locale}/auth?next=${encodeURIComponent(next)}`);
          return;
        }

        const plus = await fetchUserIsPlusMember(supabase, auth.user.id);
        if (cancelled) return;

        if (!plus) {
          setStatus("need-plus");
          setDetail(ui.needPlus);
          return;
        }

        notifyOpener(dressupOrigin);

        if (returnUrl) {
          const u = new URL(returnUrl);
          u.searchParams.set("kapi_plus", "1");
          u.searchParams.set("at", String(Date.now()));
          setStatus("done");
          setDetail(ui.returning);
          window.location.replace(u.toString());
          return;
        }

        setStatus("done");
        setDetail(ui.doneStay);
      } catch {
        if (!cancelled) {
          setStatus("error");
          setDetail(ui.error);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [locale, searchParams, dressupOrigin, returnUrl, ui]);

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm text-muted-foreground">{detail}</p>
      {status === "need-plus" ? (
        <Link
          href={`/${locale}/pricing`}
          className="inline-flex h-9 items-center rounded-full bg-foreground px-4 text-sm font-medium text-background"
        >
          {ui.goPlus}
        </Link>
      ) : null}
      {status === "error" ? (
        <Link
          href={`/${locale}/pricing`}
          className="inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium"
        >
          {ui.openPricing}
        </Link>
      ) : null}
    </main>
  );
}
