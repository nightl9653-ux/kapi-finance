"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { AuthStatus } from "@/components/auth/AuthStatus";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { NotificationsEntry } from "@/components/NotificationsEntry";

export function AppHeader() {
  const t = useTranslations("nav");
  const locale = useLocale();

  const primaryNav = [
    { href: `/${locale}`, label: t("dashboard") },
    { href: `/${locale}/goals`, label: t("goals") },
    { href: `/${locale}/transactions`, label: t("transactions") },
    { href: `/${locale}/quick-record`, label: t("quickRecord") },
  ];

  const secondaryNav = [
    { href: `/${locale}/ai-assistant`, label: t("aiAssistant") },
    { href: `/${locale}/reports`, label: t("reports") },
    { href: `/${locale}/pricing`, label: t("pricing") },
    { href: `/${locale}/settings`, label: t("settings") },
  ];

  return (
    <header className="sticky top-0 z-50 border-b bg-[#FAF9F7]/90 backdrop-blur">
      <div className="mx-auto flex min-h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 py-2">
        <Link
          href={`/${locale}`}
          className="max-w-[min(12rem,42vw)] shrink-0 font-semibold leading-tight tracking-tight kapi-line-clamp-2"
        >
          {t("brand")}
        </Link>

        {/* Mobile: collapse all links into one menu to avoid crowding */}
        <details className="relative md:hidden">
          <summary className="list-none rounded-full border bg-white px-3 py-1 text-sm text-muted-foreground">
            {t("menu")}
          </summary>
          <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border bg-white shadow-lg">
            <nav className="flex flex-col py-1">
              {[...primaryNav, ...secondaryNav].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-2 text-sm text-foreground hover:bg-muted/40"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </details>

        {/* Desktop/tablet: show primary nav + a More dropdown for secondary links */}
        <nav className="hidden min-w-0 flex-1 items-center gap-4 md:ml-6 md:flex">
          {primaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}

          <details className="relative">
            <summary className="list-none cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              {t("more")}
            </summary>
            <div className="absolute left-0 mt-2 w-52 overflow-hidden rounded-xl border bg-white shadow-lg">
              <nav className="flex flex-col py-1">
                {secondaryNav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="px-3 py-2 text-sm text-foreground hover:bg-muted/40"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </details>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <NotificationsEntry />
          <AuthStatus />
          <LocaleSwitcher />
        </div>
      </div>
    </header>
  );
}
