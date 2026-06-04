import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type GuestFeatureKey =
  | "goals"
  | "transactions"
  | "quickRecord"
  | "aiAssistant"
  | "reports"
  | "settings";

export async function FeatureGuestLanding({
  locale,
  feature,
  signInNext,
}: {
  locale: "zh" | "en";
  feature: GuestFeatureKey;
  signInNext: string;
}) {
  const t = await getTranslations("guestLanding");
  const nav = await getTranslations("nav");
  const ta = await getTranslations("auth");

  const navKey =
    feature === "quickRecord"
      ? "quickRecord"
      : feature === "aiAssistant"
        ? "aiAssistant"
        : feature;
  const title = nav(navKey);

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border bg-gradient-to-br from-[#F4EFEA] via-[#FAF9F7] to-[#EEE7DE] p-8">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("badge")}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{t(`${feature}.lead`)}</p>
        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
          {(t.raw(`${feature}.bullets`) as string[]).map((item) => (
            <li key={item} className="flex gap-2 text-sm">
              <span className="text-emerald-700" aria-hidden>
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/${locale}/auth?next=${encodeURIComponent(signInNext)}`}
            className={cn(buttonVariants({ size: "lg" }), "rounded-full")}
          >
            {ta("signIn")}
          </Link>
          <Link
            href={`/${locale}/pricing`}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-full")}
          >
            {t("viewPricing")}
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">{t("signInNote")}</p>
      </div>
    </div>
  );
}
