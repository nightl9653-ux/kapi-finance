import { getTranslations } from "next-intl/server";

export default async function AIAssistantPage() {
  const nav = await getTranslations("nav");
  const t = await getTranslations("aiAssistantPage");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{nav("aiAssistant")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="rounded-2xl border bg-white/70 p-6">
        <div className="text-sm text-muted-foreground">{t("placeholder")}</div>
      </div>
    </div>
  );
}

