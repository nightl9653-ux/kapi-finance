import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Suspense } from "react";

import { CreditPackCards } from "@/components/pricing/CreditPackCards";
import { PlusPlanCards } from "@/components/pricing/PlusPlanCards";
import { PricingCheckoutFlash } from "@/components/pricing/PricingCheckoutFlash";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchUserIsPlusMember } from "@/lib/user-plus-membership";

type LocaleSeg = "zh" | "en";

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (raw === "zh" ? "zh" : "en") as LocaleSeg;
  const t = await getTranslations("pricing");
  const ta = await getTranslations("auth");

  let isPlus: boolean | null = null;
  if (isSupabaseConfigured) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        isPlus = await fetchUserIsPlusMember(supabase, auth.user.id);
      }
    } catch {
      isPlus = null;
    }
  }

  return (
    <div className="space-y-10">
      <Suspense fallback={null}>
        <PricingCheckoutFlash />
      </Suspense>

      <div className="rounded-3xl border bg-gradient-to-br from-[#F4EFEA] via-[#FAF9F7] to-[#EEE7DE] p-8">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("subtitle")}</p>

        <p className="mt-4 inline-flex rounded-full border border-amber-200/80 bg-amber-50/90 px-3 py-1 text-xs font-medium text-amber-950">
          {t("promo")}
        </p>

        {isPlus === true ? (
          <p className="mt-4 text-sm font-medium text-emerald-800">{t("youArePlus")}</p>
        ) : null}
        {isPlus === false ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("youAreFree")}</p>
        ) : null}
        {isPlus === null && isSupabaseConfigured ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {t("guestHint")}{" "}
            <Link href={`/${locale}/auth`} className="font-medium text-foreground underline underline-offset-4">
              {ta("signIn")}
            </Link>
          </p>
        ) : null}
      </div>

      <PlusPlanCards locale={locale} signInHref={`/${locale}/auth`} />

      <CreditPackCards
        locale={locale}
        signInHref={`/${locale}/auth`}
        labels={{
          title: t("creditPacks.title"),
          blurb: t("creditPacks.blurb"),
          plusOnly: t("creditPacks.plusOnly"),
          signIn: ta("signIn"),
          buy: t("creditPacks.buy"),
          comingSoon: t("creditPacks.comingSoon"),
          plusOnlyCta: t("creditPacks.plusOnlyCta"),
          standardPackTitle: t("creditPacks.standard.title"),
          standardPackDesc: t("creditPacks.standard.desc"),
          hqPackTitle: t("creditPacks.hq.title"),
          hqPackDesc: t("creditPacks.hq.desc"),
        }}
      />

      <div id="compare" className="scroll-mt-24 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">{t("compareTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("compareBlurb")}</p>
        </div>

        <div className="overflow-x-auto rounded-2xl border bg-white/70">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left">
                <th className="px-4 py-3 font-medium">{t("compareFeatureColumn")}</th>
                <th className="px-4 py-3 font-medium">{t("badgeFree")}</th>
                <th className="px-4 py-3 font-medium">{t("badgePlus")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(
                [
                  {
                    key: "goals",
                    label: t("compare.goals.label"),
                    free: t("compare.goals.free"),
                    plus: t("compare.goals.plus"),
                  },
                  {
                    key: "record",
                    label: t("compare.record.label"),
                    free: t("compare.record.free"),
                    plus: t("compare.record.plus"),
                  },
                  {
                    key: "banquet",
                    label: t("compare.banquet.label"),
                    free: t("compare.banquet.free"),
                    plus: t("compare.banquet.plus"),
                  },
                  {
                    key: "renovation",
                    label: t("compare.renovation.label"),
                    free: t("compare.renovation.free"),
                    plus: t("compare.renovation.plus"),
                  },
                  {
                    key: "meetings",
                    label: t("compare.meetings.label"),
                    free: t("compare.meetings.free"),
                    plus: t("compare.meetings.plus"),
                  },
                  {
                    key: "scan",
                    label: t("compare.scan.label"),
                    free: t("compare.scan.free"),
                    plus: t("compare.scan.plus"),
                  },
                  {
                    key: "voice",
                    label: t("compare.voice.label"),
                    free: t("compare.voice.free"),
                    plus: t("compare.voice.plus"),
                  },
                  {
                    key: "ai",
                    label: t("compare.ai.label"),
                    free: t("compare.ai.free"),
                    plus: t("compare.ai.plus"),
                  },
                  {
                    key: "dream",
                    label: t("compare.dream.label"),
                    free: t("compare.dream.free"),
                    plus: t("compare.dream.plus"),
                  },
                  {
                    key: "dressup",
                    label: t("compare.dressup.label"),
                    free: t("compare.dressup.free"),
                    plus: t("compare.dressup.plus"),
                  },
                  {
                    key: "support",
                    label: t("compare.support.label"),
                    free: t("compare.support.free"),
                    plus: t("compare.support.plus"),
                  },
                ] as const
              ).map((row) => (
                <tr key={row.key} className="hover:bg-muted/20">
                  <td className="px-4 py-3 text-muted-foreground">{row.label}</td>
                  <td className="px-4 py-3">{row.free}</td>
                  <td className="px-4 py-3 font-medium">{row.plus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
