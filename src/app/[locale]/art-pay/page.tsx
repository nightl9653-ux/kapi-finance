import { getTranslations } from "next-intl/server";

import { getArtPublicUrl, parseAllowedArtOrigin } from "@/lib/art-origins";
import { firstSearchParam } from "@/lib/url-search-params";

export const dynamic = "force-dynamic";

function ArtPayMessage({ title, body, backHref, backLabel }: { title: string; body: string; backHref: string; backLabel: string }) {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      <a
        href={backHref}
        className="mt-6 inline-flex items-center justify-center rounded-full border border-foreground/15 bg-[#FAF9F7] px-4 py-2 text-sm font-medium hover:bg-muted/60"
      >
        {backLabel}
      </a>
    </main>
  );
}

/** 出钱已改为艺术站后端调咔账接口，不再在咔账登录。旧链接回到艺术站。 */
export default async function ArtPayPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await params;
  const t = await getTranslations("artPay");
  const sp = searchParams ? await searchParams : {};
  const returnOrigin = parseAllowedArtOrigin(firstSearchParam(sp.return_origin)) ?? getArtPublicUrl();
  return (
    <ArtPayMessage title={t("useArtSiteTitle")} body={t("useArtSiteBody")} backHref={`${returnOrigin}/`} backLabel={t("back")} />
  );
}
