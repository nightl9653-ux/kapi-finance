"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PackRow = {
  id: string;
  price_usd: number;
  standard_images: number;
  hq_images: number;
  valid_days: number;
  checkout_configured: boolean;
};

type CreditPacksResponse = {
  ok?: boolean;
  tier?: string | null;
  packs?: PackRow[];
  checkout_urls?: Partial<Record<string, string>>;
};

export function CreditPackCards(props: {
  locale: "zh" | "en";
  labels: {
    title: string;
    blurb: string;
    plusOnly: string;
    signIn: string;
    buy: string;
    comingSoon: string;
    standardPackTitle: string;
    standardPackDesc: string;
    hqPackTitle: string;
    hqPackDesc: string;
  };
  signInHref: string;
}) {
  const { locale, labels, signInHref } = props;
  const t = useTranslations("pricing");
  const [data, setData] = useState<CreditPacksResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/credit-packs");
        const json = (await res.json()) as CreditPacksResponse;
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
  }, []);

  const packs = data?.packs ?? [];
  const tier = data?.tier;
  const urls = data?.checkout_urls ?? {};

  const copyFor = (id: string) => {
    if (id === "images_20") return { title: labels.standardPackTitle, desc: labels.standardPackDesc };
    if (id === "hq_10") return { title: labels.hqPackTitle, desc: labels.hqPackDesc };
    return { title: id, desc: "" };
  };

  return (
    <div id="credit-packs" className="scroll-mt-24 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{labels.title}</h2>
        <p className="text-sm text-muted-foreground">{labels.blurb}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {loading ? (
          <p className="col-span-2 text-sm text-muted-foreground">{locale === "zh" ? "加载中…" : "Loading…"}</p>
        ) : (
          packs.map((pack) => {
            const { title, desc } = copyFor(pack.id);
            const checkoutUrl = urls[pack.id];
            const canBuy = tier === "plus" && Boolean(checkoutUrl);
            return (
              <div key={pack.id} className="flex flex-col rounded-2xl border bg-white/80 p-5 shadow-sm">
                <div className="text-sm font-medium">{title}</div>
                <div className="mt-2 text-2xl font-semibold tabular-nums">${pack.price_usd.toFixed(2)}</div>
                <p className="mt-2 min-h-[3rem] text-xs text-muted-foreground">{desc}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("creditPacks.validDays", { days: pack.valid_days })}
                </p>
                {tier !== "plus" ? <p className="mt-3 text-xs text-amber-800">{labels.plusOnly}</p> : null}
                {canBuy ? (
                  <a
                    href={checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonVariants(), "mt-auto w-full rounded-full")}
                  >
                    {labels.buy}
                  </a>
                ) : (
                  <Button type="button" disabled className="mt-auto w-full rounded-full" title={labels.comingSoon}>
                    {tier === null ? labels.signIn : labels.comingSoon}
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>
      {tier === null && !loading ? (
        <p className="text-center text-xs text-muted-foreground">
          <a href={signInHref} className="underline underline-offset-4">
            {labels.signIn}
          </a>
        </p>
      ) : null}
    </div>
  );
}