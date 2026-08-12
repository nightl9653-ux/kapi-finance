"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { AuthUserEmail } from "@/components/auth/AuthStatus";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; external?: boolean };

const EDGE_WIDTH_PX = 20;
const SWIPE_OPEN_PX = 56;
const SWIPE_CLOSE_PX = 80;

export function MobileNavDrawer({
  brand,
  openLabel,
  closeLabel,
  primaryLabel,
  secondaryLabel,
  swipeHint,
  primaryNav,
  secondaryNav,
}: {
  brand: string;
  openLabel: string;
  closeLabel: string;
  primaryLabel: string;
  secondaryLabel: string;
  swipeHint: string;
  primaryNav: NavItem[];
  secondaryNav: NavItem[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const touchRef = useRef<{ x: number; y: number; fromEdge: boolean } | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (window.matchMedia("(min-width: 768px)").matches) return;
      const t = e.touches[0];
      if (!t) return;
      touchRef.current = {
        x: t.clientX,
        y: t.clientY,
        fromEdge: !open && t.clientX <= EDGE_WIDTH_PX,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      const start = touchRef.current;
      const t = e.touches[0];
      if (!start || !t) return;

      const dx = t.clientX - start.x;
      const dy = Math.abs(t.clientY - start.y);
      if (dy > 40) {
        touchRef.current = null;
        return;
      }

      if (!open && start.fromEdge && dx >= SWIPE_OPEN_PX) {
        setOpen(true);
        touchRef.current = null;
      }

      if (open && dx <= -SWIPE_CLOSE_PX) {
        close();
        touchRef.current = null;
      }
    };

    const onTouchEnd = () => {
      touchRef.current = null;
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [open, close]);

  return (
    <>
      <button
        type="button"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-white text-muted-foreground hover:text-foreground md:hidden"
        aria-expanded={open}
        aria-controls="mobile-nav-drawer"
        aria-label={open ? closeLabel : openLabel}
        onClick={toggle}
      >
        <span className="sr-only">{open ? closeLabel : openLabel}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className={cn(open && "hidden")}>
          <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className={cn(!open && "hidden")}>
          <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <div
        className={cn(
          "fixed inset-0 z-[60] md:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!open}
      >
        <button
          type="button"
          className={cn(
            "absolute inset-0 bg-black/30 transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0",
          )}
          aria-label={closeLabel}
          tabIndex={open ? 0 : -1}
          onClick={close}
        />

        <aside
          id="mobile-nav-drawer"
          ref={panelRef}
          className={cn(
            "absolute left-0 top-0 flex h-full w-[min(18rem,86vw)] flex-col border-r bg-[#FAF9F7] shadow-xl transition-transform duration-300 ease-out",
            open ? "translate-x-0" : "-translate-x-full",
          )}
          role="dialog"
          aria-modal="true"
          aria-label={openLabel}
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold leading-tight">{brand}</p>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              aria-label={closeLabel}
              onClick={close}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <AuthUserEmail placement="menu" />

          <nav className="flex-1 overflow-y-auto px-2 py-2">
            <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {primaryLabel}
            </p>
            <ul>
              {primaryNav.map((item) => (
                <li key={item.href}>
                  {item.external ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-muted/50"
                      onClick={close}
                    >
                      {item.label}
                    </a>
                  ) : (
                    <Link
                      href={item.href}
                      className="block rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-muted/50"
                      onClick={close}
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>

            <p className="px-3 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {secondaryLabel}
            </p>
            <ul>
              {secondaryNav.map((item) => (
                <li key={item.href}>
                  {item.external ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-muted/50"
                      onClick={close}
                    >
                      {item.label}
                    </a>
                  ) : (
                    <Link
                      href={item.href}
                      className="block rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-muted/50"
                      onClick={close}
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          <p className="border-t px-4 py-3 text-[11px] text-muted-foreground">{swipeHint}</p>
        </aside>
      </div>
    </>
  );
}
