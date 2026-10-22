import { redirect } from "next/navigation";

import type { Locale } from "@/i18n/locales";

/** 旧入口：周期账单管理已并入「固定账单」看板 */
export default async function RecurringBillsRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: raw } = await params;
  const locale = (raw === "zh" ? "zh" : "en") as Locale;
  const sp = searchParams ? await searchParams : {};
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string" && v) qs.set(k, v);
    else if (Array.isArray(v) && v[0]) qs.set(k, v[0]);
  }
  const q = qs.toString();
  redirect(`/${locale}/fixed-costs${q ? `?${q}` : ""}`);
}
