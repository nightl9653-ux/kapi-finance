import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

export default async function PricingPage() {
  const t = await getTranslations("pricing");

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border bg-gradient-to-br from-[#F4EFEA] via-[#FAF9F7] to-[#EEE7DE] p-8">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("features")}</p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button className="rounded-full bg-[#8B5CF6] hover:bg-[#7C3AED]">
            {t("cta")}
          </Button>
          <Button variant="secondary" className="rounded-full">
            {t("compareCta")}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-white/70 p-6">
        <div className="text-sm text-muted-foreground">{t("tablePlaceholder")}</div>
      </div>
    </div>
  );
}

