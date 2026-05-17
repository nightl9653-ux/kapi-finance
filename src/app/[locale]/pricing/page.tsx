import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

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
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_plus_member")
          .eq("id", auth.user.id)
          .maybeSingle();
        isPlus = Boolean(profile?.is_plus_member);
      }
    } catch {
      isPlus = null;
    }
  }

  const planKeys = ["monthly", "quarterly", "yearly", "lifetime"] as const;

  return (
    <div className="space-y-10">
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {planKeys.map((key) => {
          const recommended = key === "yearly";
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
              <Button
                type="button"
                disabled
                className={cn(
                  "mt-auto w-full rounded-full",
                  recommended && "bg-[#8B5CF6] hover:bg-[#8B5CF6]",
                )}
                title={t("checkoutNote")}
                aria-label={t(`plans.${key}.pick`)}
              >
                {t("ctaDisabledHint")}
              </Button>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">{t("checkoutNote")}</p>

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
              {(["goals", "record", "scan", "voice", "ai", "dream", "support"] as const).map((row) => (
                <tr key={row} className="hover:bg-muted/20">
                  <td className="px-4 py-3 text-muted-foreground">{t(`compare.${row}.label`)}</td>
                  <td className="px-4 py-3">{t(`compare.${row}.free`)}</td>
                  <td className="px-4 py-3 font-medium">{t(`compare.${row}.plus`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
