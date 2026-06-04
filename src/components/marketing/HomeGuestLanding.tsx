import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export async function HomeGuestLanding({ locale }: { locale: "zh" | "en" }) {
  const t = await getTranslations("homeLanding");
  const ta = await getTranslations("auth");

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border bg-gradient-to-br from-[#F4EFEA] via-[#FAF9F7] to-[#EEE7DE] p-8 sm:p-10">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("heroTitle")}</h1>
        <p className="mt-3 max-w-2xl text-base text-muted-foreground">{t("heroSubtitle")}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/${locale}/auth?next=${encodeURIComponent(`/${locale}`)}`}
            className={cn(buttonVariants({ size: "lg" }), "rounded-full")}
          >
            {ta("signUp")}
          </Link>
          <Link
            href={`/${locale}/auth?next=${encodeURIComponent(`/${locale}`)}`}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-full")}
          >
            {ta("signIn")}
          </Link>
          <Link
            href={`/${locale}/pricing`}
            className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "rounded-full")}
          >
            {t("viewPricing")}
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {(t.raw("features") as { title: string; body: string; href: string }[]).map((f) => (
          <Link
            key={f.href}
            href={`/${locale}${f.href}`}
            className="rounded-2xl border bg-white/70 p-6 transition-colors hover:bg-white"
          >
            <h2 className="text-lg font-medium">{f.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            <span className="mt-3 inline-block text-sm font-medium text-foreground">{t("learnMore")} →</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
