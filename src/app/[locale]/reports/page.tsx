import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ReportExportButtons } from "@/components/reports/ReportExportButtons";
import { OrnamentDivider } from "@/components/reports/OrnamentDivider";
import { GoldDustFall } from "@/components/reports/GoldDustFall";
import { ReportsCurrencyPicker } from "@/components/reports/ReportsCurrencyPicker";
import { DashboardMonthPicker } from "@/components/dashboard/DashboardMonthPicker";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/locales";
import { reportsAuthReturnPath } from "@/lib/auth-return-path";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatCategoryLabel } from "@/lib/transaction-categories";
import { BASE_CURRENCY, coerceCurrency, type Currency } from "@/lib/fx";

const TREND_OPTIONS = [3, 6, 12, 18, 24] as const;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
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

function shiftByMonths(y: number, m: number, delta: number): { y: number; m: number } {
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
}

function formatYearMonth(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, "0")}`;
}

function parseTrendWindow(raw: string | undefined): number {
  const n = raw ? parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && (TREND_OPTIONS as readonly number[]).includes(n)) return n;
  return 6;
}

function monthSequenceEndAt(y: number, m: number, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const s = shiftByMonths(y, m, -(count - 1) + i);
    out.push(formatYearMonth(s.y, s.m));
  }
  return out;
}

type TxRow = {
  amount: string | number | null;
  amount_base: string | number | null;
  category: string | null;
  type: "income" | "expense" | null;
  occurred_on: string | null;
};

function moneyValue(r: TxRow): number {
  const b = r.amount_base;
  if (b !== null && b !== undefined && String(b).length > 0) {
    const n = Number(b);
    if (Number.isFinite(n)) return n;
  }
  return Number(r.amount ?? 0) || 0;
}

type CatAgg = { key: string; amount: number; type: "expense" | "income" };

function sortAggDesc(items: CatAgg[]): CatAgg[] {
  return [...items].sort((a, b) => b.amount - a.amount);
}

type TrendPoint = { ym: string; income: number; expense: number; net: number };

async function fetchFxRateUsdTo(display: Currency, dateIso: string): Promise<number> {
  if (display === BASE_CURRENCY) return 1;
  const api = new URL(`https://api.frankfurter.app/${dateIso}`);
  api.searchParams.set("from", BASE_CURRENCY);
  api.searchParams.set("to", display);
  const res = await fetch(api.toString(), { cache: "no-store" });
  if (!res.ok) return 1;
  const data = (await res.json().catch(() => null)) as null | { rates?: Record<string, number> };
  const rate = Number(data?.rates?.[display]);
  return Number.isFinite(rate) && rate > 0 ? rate : 1;
}

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const nav = await getTranslations("nav");
  const t = await getTranslations("reportsPage");
  const tCal = await getTranslations("calendar");
  const tTx = await getTranslations("transactions");

  const { locale: raw } = await params;
  const locale = (raw === "zh" ? "zh" : "en") as Locale;
  const sp = searchParams ? await searchParams : {};
  const monthRaw = typeof sp.month === "string" ? sp.month : undefined;
  const trendN = parseTrendWindow(typeof sp.months === "string" ? sp.months : undefined);
  const displayCurrency = coerceCurrency(typeof sp.dc === "string" ? sp.dc : BASE_CURRENCY);

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
  const reportsPath = `/${locale}/reports`;

  const startRef = shiftByMonths(ref.y, ref.m, -(trendN - 1));
  const rangeStartIso = isoDate(new Date(Date.UTC(startRef.y, startRef.m - 1, 1)));

  const buildQuery = (monthYm: string) => {
    const p = new URLSearchParams();
    p.set("month", monthYm);
    if (trendN !== 6) p.set("months", String(trendN));
    if (displayCurrency !== BASE_CURRENCY) p.set("dc", displayCurrency);
    return p.toString();
  };

  const usdToDisplay = await fetchFxRateUsdTo(displayCurrency, monthEndIso);
  const money = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
    style: "currency",
    currency: displayCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const money0 = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
    style: "currency",
    currency: displayCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const fmt = (usd: number) => money.format(usd * usdToDisplay);
  const fmt0 = (usd: number) => money0.format(usd * usdToDisplay);

  if (!isSupabaseConfigured) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">{nav("reports")}</h1>
          <p className="text-sm text-muted-foreground">{tCal("supabaseNotConfigured")}</p>
        </div>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    const returnTo = reportsAuthReturnPath(locale, sp);
    redirect(`/${locale}/auth?next=${encodeURIComponent(returnTo)}`);
  }

  const { data: rows } = await supabase
    .from("transactions")
    .select("amount,amount_base,category,type,occurred_on")
    .eq("user_id", auth.user.id)
    .gte("occurred_on", rangeStartIso)
    .lte("occurred_on", monthEndIso);

  const cat = (k: string) => tTx(k);
  const expenseByCat = new Map<string, number>();
  const incomeByCat = new Map<string, number>();
  const byMonth = new Map<string, { inc: number; exp: number }>();
  let totalIncome = 0;
  let totalExpense = 0;

  for (const r of (rows ?? []) as TxRow[]) {
    const v = moneyValue(r);
    const on = String(r.occurred_on ?? "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(on)) {
      const ym = on.slice(0, 7);
      const curM = byMonth.get(ym) ?? { inc: 0, exp: 0 };
      if (r.type === "income") curM.inc += v;
      else if (r.type === "expense") curM.exp += v;
      if (r.type === "income" || r.type === "expense") byMonth.set(ym, curM);
    }

    if (on < monthStartIso || on > monthEndIso) continue;

    const type = r.type;
    if (type === "income") {
      totalIncome += v;
      const k = String(r.category ?? "").trim();
      incomeByCat.set(k, (incomeByCat.get(k) ?? 0) + v);
    } else if (type === "expense") {
      totalExpense += v;
      const k = String(r.category ?? "").trim();
      expenseByCat.set(k, (expenseByCat.get(k) ?? 0) + v);
    }
  }

  const ymSeq = monthSequenceEndAt(ref.y, ref.m, trendN);
  const trend: TrendPoint[] = ymSeq.map((ym) => {
    const o = byMonth.get(ym) ?? { inc: 0, exp: 0 };
    return { ym, income: o.inc, expense: o.exp, net: o.inc - o.exp };
  });
  const trendMax = Math.max(1, ...trend.flatMap((p) => [p.income, p.expense]));

  const expenseList: CatAgg[] = sortAggDesc(
    [...expenseByCat.entries()].map(([key, amount]) => ({
      key,
      amount,
      type: "expense" as const,
    })),
  );
  const incomeList: CatAgg[] = sortAggDesc(
    [...incomeByCat.entries()].map(([key, amount]) => ({
      key,
      amount,
      type: "income" as const,
    })),
  );

  const hasAny = totalIncome > 0 || totalExpense > 0;
  const hasTrend = trend.some((p) => p.income > 0 || p.expense > 0);

  const kindExpense = t("rowKindExpense");
  const kindIncome = t("rowKindIncome");
  const categoryExportRows: { kind: string; label: string; amount: number; sharePct: number }[] = [];
  for (const row of expenseList) {
    const label = row.key ? formatCategoryLabel(row.key, "expense", cat) : t("uncategorized");
    const share = totalExpense > 0 ? (row.amount / totalExpense) * 100 : 0;
    categoryExportRows.push({ kind: kindExpense, label, amount: row.amount, sharePct: share });
  }
  for (const row of incomeList) {
    const label = row.key ? formatCategoryLabel(row.key, "income", cat) : t("uncategorized");
    const share = totalIncome > 0 ? (row.amount / totalIncome) * 100 : 0;
    categoryExportRows.push({ kind: kindIncome, label, amount: row.amount, sharePct: share });
  }

  return (
    <div className="space-y-[0.95rem]">
      <div className="space-y-[0.45rem]">
        <h1 className="text-2xl font-semibold">{nav("reports")}</h1>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          <ReportsCurrencyPicker
            label={tTx("fxDisplayCurrency")}
            reportsPath={reportsPath}
            viewingYm={viewingYm}
            trendN={trendN}
            displayCurrency={displayCurrency}
          />
        </div>
      </div>

      <div className="rounded-2xl border bg-white/70 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-dashed border-border/60 pb-4">
          <div className="min-w-0 space-y-1.5">
            <DashboardMonthPicker
              locale={locale}
              value={viewingYm}
              ariaLabel={tCal("selectMonth")}
              hrefPrefix={reportsPath}
              extraParams={{
                months: trendN === 6 ? "" : String(trendN),
                dc: displayCurrency === BASE_CURRENCY ? "" : displayCurrency,
              }}
            />
            <div className="text-xs text-muted-foreground">
              {tCal("range", { start: monthStartIso, end: monthEndIso })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <ReportExportButtons
              locale={locale}
              viewingYm={viewingYm}
              copy={{
                exportThisMonth: t("exportThisMonth"),
                exportTrend: t("exportTrend"),
                colKind: t("colKind"),
                colLabel: t("colLabel"),
                colAmount: t("colAmount"),
                colShare: t("colShare"),
                colMonth: t("colMonth"),
                colIncome: t("colIncome"),
                colExpense: t("colExpense"),
                colNet: t("colNet"),
              }}
              current={{
                totalIncome,
                totalExpense,
                net: totalIncome - totalExpense,
                categoryRows: categoryExportRows,
              }}
              trend={trend}
              trendFileSuffix={`${trendN}m-ends-${viewingYm}`}
            />
            {!isViewingCurrentMonth ? (
              <Link
                href={`${reportsPath}?${buildQuery(currentYm)}`}
                className="rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100/80"
              >
                {tCal("backToThisMonth")}
              </Link>
            ) : null}
            <Link
              href={`${reportsPath}?${buildQuery(prevYm)}`}
              className="rounded-full border bg-white px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/40"
            >
              {tCal("prevMonth")}
            </Link>
            <Link
              href={`${reportsPath}?${buildQuery(nextYm)}`}
              className="rounded-full border bg-white px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/40"
            >
              {tCal("nextMonth")}
            </Link>
            <Link
              href={viewingYm === currentYm ? `/${locale}` : `/${locale}?month=${encodeURIComponent(viewingYm)}`}
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              {t("openCalendar")}
            </Link>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">{t("baseNote")}</p>

        {hasAny ? (
          <div className="mt-6 space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/80 px-4 py-3">
                <div className="text-xs font-medium text-emerald-900/80">{t("totalIncome")}</div>
                <div className="mt-1 text-lg font-semibold tabular-nums text-emerald-950">
                  {fmt(totalIncome)}
                </div>
              </div>
              <div className="rounded-xl border border-rose-200/60 bg-rose-50/80 px-4 py-3">
                <div className="text-xs font-medium text-rose-900/80">{t("totalExpense")}</div>
                <div className="mt-1 text-lg font-semibold tabular-nums text-rose-950">
                  {fmt(totalExpense)}
                </div>
              </div>
              <div className="rounded-xl border bg-muted/30 px-4 py-3">
                <div className="text-xs font-medium text-muted-foreground">{t("net")}</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {fmt(totalIncome - totalExpense)}
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-foreground">{t("expenseByCategory")}</h2>
              {expenseList.length ? (
                <ul className="mt-3 space-y-3">
                  {expenseList.map((row) => {
                    const label = row.key
                      ? formatCategoryLabel(row.key, "expense", cat)
                      : t("uncategorized");
                    const share = totalExpense > 0 ? (row.amount / totalExpense) * 100 : 0;
                    return (
                      <li key={row.key ? `e-${row.key}` : "e-uncat"}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate font-medium">{label}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {fmt(row.amount)} <span className="text-xs">({share.toFixed(0)}%)</span>
                          </span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-rose-100">
                          <div
                            className="h-full rounded-full bg-rose-500/90 transition-[width]"
                            style={{ width: `${Math.min(100, share)}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">{t("noExpenseThisMonth")}</p>
              )}
            </div>

            <div>
              <h2 className="text-sm font-semibold text-foreground">{t("incomeByCategory")}</h2>
              {incomeList.length ? (
                <ul className="mt-3 space-y-3">
                  {incomeList.map((row) => {
                    const label = row.key
                      ? formatCategoryLabel(row.key, "income", cat)
                      : t("uncategorized");
                    const share = totalIncome > 0 ? (row.amount / totalIncome) * 100 : 0;
                    return (
                      <li key={row.key ? `i-${row.key}` : "i-uncat"}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate font-medium">{label}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {fmt(row.amount)} <span className="text-xs">({share.toFixed(0)}%)</span>
                          </span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-emerald-100">
                          <div
                            className="h-full rounded-full bg-emerald-500/90 transition-[width]"
                            style={{ width: `${Math.min(100, share)}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">{t("noIncomeThisMonth")}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-2 text-sm text-muted-foreground">
            <p>{t("emptyMonth")}</p>
            {hasTrend ? (
              <p className="mt-4 flex items-start gap-2 opacity-80">
                <span className="mt-[0.2em] select-none text-[0.95em]" aria-hidden="true">
                  ↓
                </span>
                <span>{t("trendFromHistory")}</span>
              </p>
            ) : null}
          </div>
        )}

        <div className="relative mt-20 mb-14">
          <GoldDustFall />
          <OrnamentDivider className="m-0" dense scale={1.2} />
        </div>

        <div>
          <h2 className="text-[1.125rem] leading-snug font-semibold text-foreground">{t("trendTitle")}</h2>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">{t("trendWindow")}</span>
              {TREND_OPTIONS.map((n) => {
                const active = n === trendN;
                const p =
                  n === 6
                    ? `month=${encodeURIComponent(viewingYm)}`
                    : `month=${encodeURIComponent(viewingYm)}&months=${n}`;
                return (
                  <Link
                    key={n}
                    href={`${reportsPath}?${p}`}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs",
                      active
                        ? "border-foreground/20 bg-foreground/5 font-medium"
                        : "border-transparent text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    {n}
                  </Link>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-muted-foreground/80">{t("trendMonthsN", { n: trendN })}</p>
          <div className="mt-3 space-y-4">
            {hasTrend ? (
              <div className="flex h-32 items-end gap-1 overflow-x-auto pb-1 sm:h-40">
                {trend.map((m) => (
                  <div
                    key={m.ym}
                    className="flex h-full min-w-[2.5rem] flex-1 flex-col items-center justify-end gap-1.5"
                    title={`${m.ym} +${fmt0(m.income)} / −${fmt0(m.expense)}`}
                  >
                    <div className="flex h-24 w-full min-w-0 max-w-14 items-end justify-center gap-0.5 sm:h-32">
                      <div
                        className="w-1/2 min-w-1 max-w-3.5 rounded-t-sm bg-emerald-500/90"
                        style={{ height: `${(m.income / trendMax) * 100}%` }}
                      />
                      <div
                        className="w-1/2 min-w-1 max-w-3.5 rounded-t-sm bg-rose-500/90"
                        style={{ height: `${(m.expense / trendMax) * 100}%` }}
                      />
                    </div>
                    <span className="w-full truncate text-center text-[10px] leading-none text-muted-foreground">
                      {m.ym}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="max-w-full overflow-x-auto">
              <table className="w-full min-w-[24rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">{t("colMonth")}</th>
                    <th className="py-2 pr-3 font-medium">{t("colIncome")}</th>
                    <th className="py-2 pr-3 font-medium">{t("colExpense")}</th>
                    <th className="py-2 font-medium">{t("colNet")}</th>
                  </tr>
                </thead>
                <tbody>
                  {trend.map((m) => (
                    <tr key={m.ym} className="border-b border-border/40 tabular-nums last:border-0">
                      <td className="py-2 pr-3 font-medium">{m.ym}</td>
                      <td className="py-2 pr-3 text-emerald-800/90">{fmt(m.income)}</td>
                      <td className="py-2 pr-3 text-rose-800/90">{fmt(m.expense)}</td>
                      <td
                        className={cn("py-2 font-medium", m.net >= 0 ? "text-emerald-900" : "text-rose-900")}
                      >
                        {fmt(m.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-4 rounded-sm bg-emerald-500/90" />
                {t("colIncome")}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-4 rounded-sm bg-rose-500/90" />
                {t("colExpense")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
