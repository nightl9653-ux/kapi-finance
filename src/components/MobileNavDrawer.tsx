"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { AuthUserEmail } from "@/components/auth/AuthStatus";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; external?: boolean };

const EDGE_WIDTH_PX = 20;
const SWIPE_OPEN_PX = 56;
const SWIPE_CLOSE_PX = 80;
/** 打开后短暂忽略遮罩点击，避免手指抬起点到刚挂上的遮罩把菜单立刻关掉 */
const BACKDROP_ARM_MS = 400;

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
  const drawerId = useId();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [backdropArmed, setBackdropArmed] = useState(false);
  const touchRef = useRef<{ x: number; y: number; fromEdge: boolean } | null>(null);

  const close = useCallback(() => setOpen(false), []);
  const openMenu = useCallback(() => setOpen(true), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setBackdropArmed(false);
      return;
    }
    const t = window.setTimeout(() => setBackdropArmed(true), BACKDROP_ARM_MS);
    return () => window.clearTimeout(t);
  }, [open]);

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
        openMenu();
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
  }, [open, close, openMenu]);

  const drawer =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[100] md:hidden" role="presentation">
            <button
              type="button"
              className="absolute inset-0 bg-black/35"
              aria-label={closeLabel}
              onClick={() => {
                if (backdropArmed) close();
              }}
            />

            <aside
              id={drawerId}
              className="absolute left-0 top-0 z-10 flex h-[100dvh] max-h-[100dvh] w-[min(18rem,86vw)] flex-col border-r bg-[#FAF9F7] shadow-xl"
              role="dialog"
              aria-modal="true"
              aria-label={openLabel}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                <p className="text-sm font-semibold leading-tight">{brand}</p>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  aria-label={closeLabel}
                  onClick={close}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M6 6l12 12M18 6 6 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>

              <AuthUserEmail placement="menu" />

              <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
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
                          className="block rounded-lg px-3 py-3 text-base text-foreground active:bg-muted/60"
                          onClick={close}
                        >
                          {item.label}
                        </a>
                      ) : (
                        <Link
                          href={item.href}
                          className="block rounded-lg px-3 py-3 text-base text-foreground active:bg-muted/60"
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
                          className="block rounded-lg px-3 py-3 text-base text-foreground active:bg-muted/60"
                          onClick={close}
                        >
                          {item.label}
                        </a>
                      ) : (
                        <Link
                          href={item.href}
                          className="block rounded-lg px-3 py-3 text-base text-foreground active:bg-muted/60"
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
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        className="relative z-[70] inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-white text-muted-foreground hover:text-foreground md:hidden"
        aria-expanded={open}
        aria-controls={drawerId}
        aria-label={open ? closeLabel : openLabel}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
      >
        <span className="sr-only">{open ? closeLabel : openLabel}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className={cn(open && "hidden")}>
          <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className={cn(!open && "hidden")}>
          <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {drawer}
    </>
  );
}
