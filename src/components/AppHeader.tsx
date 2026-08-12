"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { AuthProvider, AuthStatus, AuthUserEmail, type InitialAuth } from "@/components/auth/AuthStatus";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { MobileNavDrawer } from "@/components/MobileNavDrawer";
import { NotificationsEntry } from "@/components/NotificationsEntry";
import { useAppleMobileDevice } from "@/lib/device";
import { getDressupPublicUrl } from "@/lib/dressup-origins";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; external?: boolean };

function NavLink({ item, className }: { item: NavItem; className: string }) {
  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className={className}>
        {item.label}
      </a>
    );
  }
  return (
    <Link href={item.href} className={className}>
      {item.label}
    </Link>
  );
}

export function AppHeader({ initialAuth }: { initialAuth?: InitialAuth }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const dressupUrl = getDressupPublicUrl();
  const appleMobile = useAppleMobileDevice();

  const navPrimary: NavItem[] = [
    { href: `/${locale}`, label: t("dashboard") },
    { href: `/${locale}/goals`, label: t("goals") },
    { href: `/${locale}/transactions`, label: t("transactions") },
    { href: `/${locale}/quick-record`, label: t("quickRecord") },
    { href: `/${locale}/banquet-party`, label: t("banquetParty") },
    { href: `/${locale}/house-renovation`, label: t("houseRenovation") },
    { href: dressupUrl, label: t("dressup"), external: true },
  ];

  const navSecondary: NavItem[] = [
    { href: `/${locale}/meetings`, label: t("meetings") },
    { href: `/${locale}/ai-assistant`, label: t("aiAssistant") },
    { href: `/${locale}/reports`, label: t("reports") },
    { href: `/${locale}/pricing`, label: t("pricing") },
    { href: `/${locale}/settings`, label: t("settings") },
  ];

  const linkClassName =
    "whitespace-nowrap text-sm text-muted-foreground transition-colors hover:text-foreground";

  return (
    <AuthProvider initialAuth={initialAuth}>
      <header className="sticky top-0 z-50 border-b bg-[#FAF9F7]/90 backdrop-blur">
        <div className="mx-auto w-full max-w-5xl px-4">
          <div className="flex min-h-14 items-center justify-between gap-2 py-2 md:min-h-0 md:py-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <MobileNavDrawer
                brand={t("brand")}
                openLabel={t("openMenu")}
                closeLabel={t("closeMenu")}
                primaryLabel={t("navSectionPrimary")}
                secondaryLabel={t("navSectionSecondary")}
                swipeHint={t("swipeHint")}
                primaryNav={navPrimary}
                secondaryNav={navSecondary}
              />
              <Link
                href={`/${locale}`}
                className="min-w-0 flex-1 truncate text-base font-semibold leading-tight tracking-tight md:text-[0.95rem]"
                title={t("brand")}
              >
                <span className="md:hidden">{t("brandShort")}</span>
                <span className="hidden md:inline">{t("brand")}</span>
              </Link>
            </div>

            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <div
                className={cn(
                  "flex items-center gap-1 sm:gap-2",
                  // 仅苹果：铃铛与登录略松开；语言按钮仍贴右、不跟着挪
                  appleMobile && "gap-2.5",
                )}
              >
                <NotificationsEntry />
                <AuthUserEmail placement="header" />
                <AuthStatus />
              </div>
              <LocaleSwitcher />
            </div>
          </div>

          <nav className="hidden space-y-1.5 border-t border-border/60 pb-3 pt-2 md:block" aria-label={t("menu")}>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              {navPrimary.map((item) => (
                <NavLink key={item.href} item={item} className={linkClassName} />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              {navSecondary.map((item) => (
                <NavLink key={item.href} item={item} className={linkClassName} />
              ))}
            </div>
          </nav>
        </div>
      </header>
    </AuthProvider>
  );
}
