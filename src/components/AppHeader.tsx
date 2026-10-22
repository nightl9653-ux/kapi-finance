"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { AuthProvider, AuthStatus, AuthUserEmail, type InitialAuth } from "@/components/auth/AuthStatus";
import { AppleEnControlsShift } from "@/components/AppleEnControlsShift";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { MobileNavDrawer } from "@/components/MobileNavDrawer";
import { NotificationsEntry } from "@/components/NotificationsEntry";

type NavItem = { href: string; label: string };

function NavLink({ item, className }: { item: NavItem; className: string }) {
  return (
    <Link href={item.href} className={className}>
      {item.label}
    </Link>
  );
}

function MoreMenu({ label, items }: { label: string; items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="whitespace-nowrap text-xs text-muted-foreground transition-colors hover:text-foreground"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {label}
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 min-w-40 rounded-xl border bg-[#FAF9F7] p-1 shadow-lg">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted/60"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AppHeader({ initialAuth }: { initialAuth?: InitialAuth }) {
  const t = useTranslations("nav");
  const locale = useLocale();

  const navLead: NavItem[] = [
    { href: `/${locale}/gigs`, label: t("gigs") },
    { href: `/${locale}/transactions`, label: t("transactions") },
  ];

  const navBeside: NavItem[] = [
    { href: `/${locale}/meetings`, label: t("meetings") },
    { href: `/${locale}/travel`, label: t("travel") },
    { href: `/${locale}/fixed-costs`, label: t("fixedCosts") },
  ];

  const navMore: NavItem[] = [
    { href: `/${locale}`, label: t("dashboard") },
    { href: `/${locale}/goals`, label: t("goals") },
    { href: `/${locale}/quick-record`, label: t("quickRecord") },
    { href: `/${locale}/banquet-party`, label: t("banquetParty") },
    { href: `/${locale}/ai-assistant`, label: t("aiAssistant") },
    { href: `/${locale}/reports`, label: t("reports") },
    { href: `/${locale}/house-renovation`, label: t("houseRenovation") },
    { href: `/${locale}/pricing`, label: t("pricing") },
    { href: `/${locale}/settings`, label: t("settings") },
  ];

  const leadClassName = "whitespace-nowrap text-base font-medium text-foreground transition-colors hover:text-foreground";
  const besideClassName = "whitespace-nowrap text-xs text-muted-foreground transition-colors hover:text-foreground";

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
                primaryNav={[...navLead, ...navBeside]}
                secondaryNav={navMore}
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
              <NotificationsEntry />
              <AuthUserEmail placement="header" />
              <AuthStatus />
              <AppleEnControlsShift />
              <LocaleSwitcher />
            </div>
          </div>

          <nav className="hidden border-t border-border/60 pb-3 pt-2 md:block" aria-label={t("menu")}>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              {navLead.map((item) => (
                <NavLink key={item.href} item={item} className={leadClassName} />
              ))}
              {navBeside.map((item) => (
                <NavLink key={item.href} item={item} className={besideClassName} />
              ))}
              <MoreMenu label={t("more")} items={navMore} />
            </div>
          </nav>
        </div>
      </header>
    </AuthProvider>
  );
}
