"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

/** 付完款回到 ?checkout=success 时展示提示，并在一段时间后清理该 query。 */
export function PricingCheckoutFlash() {
  const t = useTranslations("pricing");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const show = searchParams.get("checkout") === "success";

  useEffect(() => {
    if (!show) return;
    const p = new URLSearchParams(searchParams.toString());
    p.delete("checkout");
    const timer = window.setTimeout(() => {
      const q = p.toString();
      router.replace(q ? `${pathname}?${q}` : pathname);
    }, 6500);
    return () => window.clearTimeout(timer);
  }, [pathname, router, searchParams, show]);

  if (!show) return null;

  return (
    <div
      className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
      role="status"
    >
      {t("checkoutSuccess")}
    </div>
  );
}
