"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PLAN_KEYS = ["monthly", "quarterly", "yearly"] as const;

type PlusCheckoutResponse = {
  ok?: boolean;
  tier?: string | null;
  checkout_urls?: Partial<Record<string, string>>;
  plans?: Array<{ id: string; checkout_configured?: boolean }>;
};

export function PlusPlanCards({
  locale,
  signInHref,
}: {
  locale: "zh" | "en";
  signInHref: string;
}) {
  const t = useTranslations("pricing");
  const [data, setData] = useState<PlusCheckoutResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/plus-checkout?locale=${encodeURIComponent(locale)}`);
        const json = (await res.json()) as PlusCheckoutResponse;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const tier = data?.tier;
  const urls = data?.checkout_urls ?? {};
  const isPlus = tier === "plus";
  const monthlyConfigured = data?.plans?.some((p) => p.id === "monthly" && p.checkout_configured) ?? false;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLAN_KEYS.map((key) => {
          const recommended = key === "yearly";
          const checkoutUrl = urls[key];
          const canCheckout = !isPlus && Boolean(checkoutUrl);

          return (
            <div
              key={key}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-white/80 p-5 shadow-sm",
                recommended && "ring-2 ring-[#8B5CF6]/35",
              )}
            >
              {recommended ? (
                <span className="absolute -top-2.5 left-4 rounded-full bg-[#8B5CF6] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  {t(`plans.yearly.recommended`)}
                </span>
              ) : null}
              <div className="text-sm font-medium text-muted-foreground">{t(`plans.${key}.name`)}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-semibold tabular-nums">{t(`plans.${key}.price`)}</span>
                <span className="text-sm text-muted-foreground">{t(`plans.${key}.period`)}</span>
              </div>
              <p className="mt-2 min-h-[2.5rem] text-xs text-muted-foreground">{t(`plans.${key}.sub`)}</p>
              {isPlus ? (
                <Button type="button" disabled className="mt-auto w-full rounded-full">
                  {t("alreadyPlus")}
                </Button>
              ) : canCheckout ? (
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    buttonVariants(),
                    "mt-auto w-full rounded-full",
                    recommended && "bg-[#8B5CF6] hover:bg-[#8B5CF6]",
                  )}
                >
                  {t(`plans.${key}.pick`)}
                </a>
              ) : (
                <Button
                  type="button"
                  disabled
                  className={cn(
                    "mt-auto w-full rounded-full",
                    recommended && "bg-[#8B5CF6] hover:bg-[#8B5CF6]",
                  )}
                  title={loading ? undefined : t("comingSoon")}
                >
                  {loading ? (locale === "zh" ? "加载中…" : "Loading…") : tier === null ? t("signInToUpgrade") : t("comingSoon")}
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {tier === null && !loading ? (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          <a href={signInHref} className="underline underline-offset-4">
            {t("signInToUpgrade")}
          </a>
        </p>
      ) : null}
      {!loading && !isPlus && tier !== null && !monthlyConfigured ? (
        <p className="mt-2 text-center text-xs text-amber-800">{t("checkoutEnvHint")}</p>
      ) : null}
      <p className="mt-4 text-center text-xs text-muted-foreground">{t("checkoutNote")}</p>
    </>
  );
}
