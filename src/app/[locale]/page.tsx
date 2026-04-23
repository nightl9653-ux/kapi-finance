import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import type { Locale } from "@/i18n/locales";
import { dashboardAuthReturnPath } from "@/lib/auth-return-path";
import { isSupabaseConfigured } from "@/lib/env";
import { DashboardMonthPicker } from "@/components/dashboard/DashboardMonthPicker";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DayAgg = { count: number; income: number; expense: number };

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysInMonth(d: Date): number {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

function mondayIndex(utcDay: number): number {
  // JS: 0=Sun..6=Sat -> 0=Mon..6=Sun
  return (utcDay + 6) % 7;
}

function parseYearMonth(s: string | undefined): { y: number; m: number } | null {
  if (!s || !/^\d{4}-\d{2}$/.test(s)) return null;
  const [ys, ms] = s.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || m < 1 || m > 12) return null;
  return { y, m };
}

function shiftYearMonth(y: number, m: number, delta: number): { y: number; m: number } {
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
}

function formatYearMonth(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, "0")}`;
}

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const nav = await getTranslations("nav");
  const t = await getTranslations("calendar");
  const { locale: raw } = await params;
  const locale = (raw === "zh" ? "zh" : "en") as Locale;
  const sp = searchParams ? await searchParams : {};
  const monthRaw = typeof sp.month === "string" ? sp.month : undefined;

  const now = new Date();
  const ref = parseYearMonth(monthRaw) ?? { y: now.getUTCFullYear(), m: now.getUTCMonth() + 1 };
  const monthStart = new Date(Date.UTC(ref.y, ref.m - 1, 1));
  const monthEnd = new Date(Date.UTC(ref.y, ref.m, 0));
  const prevRef = shiftYearMonth(ref.y, ref.m, -1);
  const nextRef = shiftYearMonth(ref.y, ref.m, 1);
  const prevYm = formatYearMonth(prevRef.y, prevRef.m);
  const nextYm = formatYearMonth(nextRef.y, nextRef.m);
  const viewingYm = formatYearMonth(ref.y, ref.m);
  const currentYm = formatYearMonth(now.getUTCFullYear(), now.getUTCMonth() + 1);
  const isViewingCurrentMonth = viewingYm === currentYm;
  const monthStartIso = isoDate(monthStart);
  const monthEndIso = isoDate(monthEnd);
  const todayIso = isoDate(new Date());

  if (!isSupabaseConfigured) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">{nav("dashboard")}</h1>
          <p className="text-sm text-muted-foreground">{t("supabaseNotConfigured")}</p>
        </div>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    const returnTo = dashboardAuthReturnPath(locale, sp);
    redirect(`/${locale}/auth?next=${encodeURIComponent(returnTo)}`);
  }

  const { data: rows } = await supabase
    .from("transactions")
    .select("occurred_on,amount,type")
    .eq("user_id", auth.user.id)
    .gte("occurred_on", monthStartIso)
    .lte("occurred_on", monthEndIso)
    .order("occurred_on", { ascending: true });

  type TxRow = { occurred_on: string | null; amount: string | number | null; type: "income" | "expense" | null };

  const agg = new Map<string, DayAgg>();
  for (const r of (rows ?? []) as TxRow[]) {
    const d = String(r.occurred_on ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    const amount = Number(r.amount ?? 0);
    const type = r.type ?? "";
    const cur = agg.get(d) ?? { count: 0, income: 0, expense: 0 };
    cur.count += 1;
    if (type === "income") cur.income += amount;
    if (type === "expense") cur.expense += amount;
    agg.set(d, cur);
  }

  const dim = daysInMonth(monthStart);
  const firstWeekday = mondayIndex(monthStart.getUTCDay());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{nav("dashboard")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="rounded-2xl border bg-white/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <DashboardMonthPicker locale={locale} value={viewingYm} ariaLabel={t("selectMonth")} />
            <div className="text-xs text-muted-foreground">
              {t("range", { start: monthStartIso, end: monthEndIso })}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isViewingCurrentMonth ? (
              <Link
                href={`/${locale}`}
                className="rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100/80"
              >
                {t("backToThisMonth")}
              </Link>
            ) : null}
            <Link
              href={`/${locale}?month=${encodeURIComponent(prevYm)}`}
              className="rounded-full border bg-white px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/40"
            >
              {t("prevMonth")}
            </Link>
            <Link
              href={`/${locale}?month=${encodeURIComponent(nextYm)}`}
              className="rounded-full border bg-white px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/40"
            >
              {t("nextMonth")}
            </Link>
            <Link
              href={`/${locale}/transactions`}
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              {t("goToTransactions")}
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-2">
          {t("weekdays")
            .split(",")
            .map((w) => (
              <div key={w} className="px-1 text-xs font-medium text-muted-foreground">
                {w}
              </div>
            ))}

          {Array.from({ length: firstWeekday }).map((_, i) => (
            <div key={`b-${i}`} className="h-20 rounded-xl border bg-white/40" />
          ))}

          {Array.from({ length: dim }).map((_, i) => {
            const day = i + 1;
            const date = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), day));
            const dIso = isoDate(date);
            const a = agg.get(dIso);
            const isToday = dIso === todayIso;
            const isPastOrToday = dIso <= todayIso;
            const missing = isPastOrToday && !a?.count;

            return (
              <Link
                key={dIso}
                href={`/${locale}/transactions?date=${encodeURIComponent(dIso)}`}
                className={[
                  "group h-20 rounded-xl border bg-white p-2 transition-colors hover:bg-muted/40",
                  isToday ? "border-foreground/30 bg-muted/20" : "",
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{day}</div>
                  {missing ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                      {t("missing")}
                    </span>
                  ) : a?.count ? (
                    <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-medium text-foreground">
                      {t("count", { n: a.count })}
                    </span>
                  ) : null}
                </div>
                {a?.count ? (
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    <div className="truncate">{t("income", { n: a.income.toFixed(2) })}</div>
                    <div className="truncate">{t("expense", { n: a.expense.toFixed(2) })}</div>
                  </div>
                ) : (
                  <div className="mt-2 text-[11px] text-muted-foreground group-hover:text-foreground/70">
                    {missing ? t("ctaBackfill") : t("ctaAdd")}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

