import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import type { Locale } from "@/i18n/locales";
import { buildFixedCostBoard } from "@/lib/fixed-costs/board";
import { formatCategoryLabel } from "@/lib/transaction-categories";
import { materializeRecurringBills, type RecurringBillRow } from "@/lib/recurring-bills";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { firstSearchParam, uuidsEqual } from "@/lib/url-search-params";
import { formatProjectMoney } from "@/lib/fx";

async function deleteRecurring(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  const locale = String(formData.get("locale") ?? "en") as Locale;
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect(`/${locale}/fixed-costs?error=invalid`);

  const { error } = await supabase.from("recurring_bills").delete().eq("id", id).eq("user_id", data.user.id);
  if (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "PGRST205") redirect(`/${locale}/fixed-costs?error=unavailable`);
    redirect(`/${locale}/fixed-costs?error=unknown`);
  }
  redirect(`/${locale}/fixed-costs?success=deleted`);
}

async function updateRecurring(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  const locale = String(formData.get("locale") ?? "en") as Locale;
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect(`/${locale}/fixed-costs?error=invalid`);

  const amountRaw = Number(formData.get("amount"));
  const currency = String(formData.get("currency") ?? "USD").trim().toUpperCase();
  const fxRateRaw = Number(formData.get("fx_rate") ?? "");
  const type = String(formData.get("type") ?? "");
  const category = String(formData.get("category") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const cadence = String(formData.get("cadence") ?? "").trim();
  const monthRaw = Number(formData.get("month_of_year") ?? "");
  const dayRaw = Number(formData.get("day_of_month") ?? "");
  const endDateRaw = String(formData.get("end_date") ?? "").trim();

  const cadenceOk =
    cadence === "daily" || cadence === "monthly" || cadence === "quarterly" || cadence === "yearly";
  const typeOk = type === "expense" || type === "income";
  const endDate = endDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(endDateRaw) ? endDateRaw : null;
  const monthOfYear = Number.isFinite(monthRaw) ? Math.max(1, Math.min(12, Math.floor(monthRaw))) : null;
  const dom = Number.isFinite(dayRaw) ? Math.max(1, Math.min(28, Math.floor(dayRaw))) : null;

  if (!Number.isFinite(amountRaw) || amountRaw <= 0 || !typeOk || !category || !cadenceOk) {
    redirect(`/${locale}/fixed-costs?error=invalid`);
  }

  const { error } = await supabase
    .from("recurring_bills")
    .update({
      amount: amountRaw,
      currency,
      fx_rate: Number.isFinite(fxRateRaw) ? fxRateRaw : null,
      type,
      category,
      note: note || null,
      cadence,
      month_of_year: cadence === "quarterly" || cadence === "yearly" ? (monthOfYear ?? 5) : null,
      day_of_month: cadence === "daily" ? null : (dom ?? 5),
      end_date: endDate,
    })
    .eq("id", id)
    .eq("user_id", data.user.id);

  if (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "PGRST205") redirect(`/${locale}/fixed-costs?error=unavailable`);
    redirect(`/${locale}/fixed-costs?error=unknown`);
  }

  redirect(`/${locale}/fixed-costs?success=updated`);
}

function statusClass(status: string): string {
  switch (status) {
    case "posted":
      return "text-emerald-700";
    case "overdue":
      return "text-rose-700";
    case "dueToday":
      return "text-amber-800";
    default:
      return "text-muted-foreground";
  }
}

export default async function FixedCostsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: raw } = await params;
  const locale = (raw === "zh" ? "zh" : "en") as Locale;
  const t = await getTranslations("fixedCosts");
  const tx = await getTranslations("transactions");
  const common = await getTranslations("common");
  const sp = searchParams ? await searchParams : {};
  const editParam = firstSearchParam(sp.edit)?.trim();

  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    redirect(`/${locale}/auth?next=${encodeURIComponent(`/${locale}/fixed-costs`)}`);
  }

  try {
    await materializeRecurringBills({ supabase, userId: auth.user.id });
  } catch {
    // 看板仍可展示规则；入账失败不阻断
  }

  const { data: rows, error } = await supabase
    .from("recurring_bills")
    .select(
      "id,user_id,amount,currency,fx_rate,type,category,merchant,note,cadence,month_of_year,day_of_month,start_date,end_date,last_generated_on,created_at",
    )
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  const unavailable = (error as { code?: string } | null)?.code === "PGRST205";
  if (error && !unavailable) redirect(`/${locale}/fixed-costs?error=unknown`);

  const bills = (rows ?? []) as RecurringBillRow[];
  const now = new Date();
  const board = buildFixedCostBoard({
    bills,
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    locale,
  });

  const expensePct =
    board.expensePlannedUsd > 0
      ? Math.min(100, Math.round((board.expensePostedUsd / board.expensePlannedUsd) * 100))
      : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${locale}/transactions`}
            className={cn(buttonVariants(), "rounded-full")}
          >
            {t("addBill")}
          </Link>
          <Link
            href={`/${locale}/transactions`}
            className={cn(buttonVariants({ variant: "secondary" }), "rounded-full")}
          >
            {t("goTransactions")}
          </Link>
        </div>
      </div>

      {unavailable ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
          {tx("errorRecurringUnavailable")}
        </p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-base font-medium">{t("thisMonth", { month: board.monthLabel })}</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border bg-white/70 p-4">
                <p className="text-xs text-muted-foreground">{t("expensePlanned")}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {formatProjectMoney(board.expensePlannedUsd, "USD")}
                </p>
              </div>
              <div className="rounded-2xl border bg-white/70 p-4">
                <p className="text-xs text-muted-foreground">{t("expensePosted")}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-800">
                  {formatProjectMoney(board.expensePostedUsd, "USD")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{t("postedPct", { pct: expensePct })}</p>
              </div>
              <div className="rounded-2xl border bg-white/70 p-4">
                <p className="text-xs text-muted-foreground">{t("expensePending")}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {formatProjectMoney(board.expensePendingUsd, "USD")}
                </p>
                {board.expenseOverdueUsd > 0 ? (
                  <p className="mt-1 text-xs text-rose-700">
                    {t("overdueAmount", { amount: formatProjectMoney(board.expenseOverdueUsd, "USD") })}
                  </p>
                ) : null}
              </div>
            </div>
            {board.incomePlannedUsd > 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("incomeLine", {
                  planned: formatProjectMoney(board.incomePlannedUsd, "USD"),
                  posted: formatProjectMoney(board.incomePostedUsd, "USD"),
                })}
              </p>
            ) : null}
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium">{t("monthListTitle")}</h2>
            {board.occurrences.length === 0 ? (
              <p className="rounded-2xl border border-dashed bg-white/50 p-6 text-sm text-muted-foreground">
                {t("monthEmpty")}
              </p>
            ) : (
              <ul className="divide-y rounded-2xl border bg-white/70">
                {board.occurrences.map((o) => (
                  <li
                    key={`${o.billId}-${o.dueOn}`}
                    className="flex flex-wrap items-start justify-between gap-2 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        <span className="tabular-nums">{o.dueOn}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {formatCategoryLabel(o.category, o.type, (k) => tx(k))}
                        </span>
                        {o.note ? <span className="text-muted-foreground"> · {o.note}</span> : null}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {o.cadence === "daily"
                          ? tx("recurringDaily")
                          : o.cadence === "quarterly"
                            ? tx("recurringQuarterly")
                            : o.cadence === "yearly"
                              ? tx("recurringYearly")
                              : tx("recurringMonthly")}
                        {o.currency !== "USD"
                          ? ` · ${formatProjectMoney(o.amount, o.currency)} ≈ ${formatProjectMoney(o.amountUsd, "USD")}`
                          : ` · ${formatProjectMoney(o.amountUsd, "USD")}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          "text-sm font-medium tabular-nums",
                          o.type === "income" ? "text-emerald-800" : "",
                        )}
                      >
                        {o.type === "income" ? "+" : "−"}
                        {formatProjectMoney(o.amountUsd, "USD")}
                      </p>
                      <p className={cn("text-xs font-medium", statusClass(o.status))}>
                        {t(`status.${o.status}`)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-base font-medium">{t("rulesTitle")}</h2>
                <p className="text-sm text-muted-foreground">{t("rulesSubtitle")}</p>
              </div>
            </div>

            <div className="rounded-2xl border bg-white/70 p-6">
              {bills.length === 0 ? (
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>{t("rulesEmpty")}</p>
                  <Link href={`/${locale}/transactions`} className="font-medium text-foreground underline underline-offset-4">
                    {t("addBill")}
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {bills.map((r) =>
                    editParam && uuidsEqual(editParam, String(r.id)) ? (
                      <form key={r.id} action={updateRecurring} className="rounded-xl border bg-white p-4">
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="id" value={r.id} />
                        <div className="grid gap-4 sm:grid-cols-4">
                          <div className="space-y-2">
                            <Label htmlFor={`amount-${r.id}`}>{tx("amount")}</Label>
                            <Input
                              id={`amount-${r.id}`}
                              name="amount"
                              type="number"
                              min="0.01"
                              step="0.01"
                              defaultValue={String(r.amount)}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`cur-${r.id}`}>{tx("currency")}</Label>
                            <Input id={`cur-${r.id}`} name="currency" defaultValue={String(r.currency ?? "USD")} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`fx-${r.id}`}>{tx("fxRateToUsd")}</Label>
                            <Input
                              id={`fx-${r.id}`}
                              name="fx_rate"
                              type="number"
                              min="0"
                              step="0.0001"
                              defaultValue={String(r.fx_rate ?? "")}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`type-${r.id}`}>{tx("typeLabel")}</Label>
                            <select
                              id={`type-${r.id}`}
                              name="type"
                              defaultValue={r.type === "income" ? "income" : "expense"}
                              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                              <option value="expense">{tx("typeExpense")}</option>
                              <option value="income">{tx("typeIncome")}</option>
                            </select>
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor={`cat-${r.id}`}>{tx("category")}</Label>
                            <Input id={`cat-${r.id}`} name="category" defaultValue={String(r.category ?? "")} required />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor={`note-${r.id}`}>{tx("note")}</Label>
                            <Input id={`note-${r.id}`} name="note" defaultValue={String(r.note ?? "")} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`cad-${r.id}`}>{tx("recurringCadence")}</Label>
                            <select
                              id={`cad-${r.id}`}
                              name="cadence"
                              defaultValue={String(r.cadence)}
                              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                              <option value="daily">{tx("recurringDaily")}</option>
                              <option value="monthly">{tx("recurringMonthly")}</option>
                              <option value="quarterly">{tx("recurringQuarterly")}</option>
                              <option value="yearly">{tx("recurringYearly")}</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`moy-${r.id}`}>{tx("recurringMonthOfYear")}</Label>
                            <Input
                              id={`moy-${r.id}`}
                              name="month_of_year"
                              type="number"
                              min="1"
                              max="12"
                              defaultValue={r.month_of_year ? String(r.month_of_year) : ""}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`dom-${r.id}`}>{tx("recurringDayOfMonth")}</Label>
                            <Input
                              id={`dom-${r.id}`}
                              name="day_of_month"
                              type="number"
                              min="1"
                              max="28"
                              defaultValue={r.day_of_month ? String(r.day_of_month) : ""}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`end-${r.id}`}>{tx("recurringEndDate")}</Label>
                            <Input id={`end-${r.id}`} name="end_date" type="date" defaultValue={r.end_date ?? ""} />
                          </div>
                          <div className="flex flex-wrap gap-2 sm:col-span-4">
                            <Button type="submit" size="sm" className="rounded-full">
                              {common("save")}
                            </Button>
                            <Link
                              scroll={false}
                              href={`/${locale}/fixed-costs`}
                              className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "rounded-full")}
                            >
                              {common("cancel")}
                            </Link>
                          </div>
                        </div>
                      </form>
                    ) : (
                      <div
                        key={r.id}
                        className="flex flex-col gap-2 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="text-sm">
                          <div className="font-medium">
                            {r.type === "income" ? "+" : "−"}
                            {Number(r.amount).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            · {formatCategoryLabel(String(r.category ?? ""), r.type, (k) => tx(k))}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {tx("recurringCadenceLabel")}: {String(r.cadence)}
                            {(r.cadence === "quarterly" || r.cadence === "yearly") && r.month_of_year
                              ? ` · ${tx("recurringMonthInYear", { n: r.month_of_year })}`
                              : ""}
                            {r.day_of_month ? ` · ${tx("recurringDayShort", { n: r.day_of_month })}` : ""}
                            {r.end_date ? ` · ${tx("recurringEndShort", { d: r.end_date })}` : ""}
                            {r.currency && String(r.currency).toUpperCase() !== "USD"
                              ? ` · ${String(r.currency)}`
                              : ""}
                            {r.note ? ` · ${r.note}` : ""}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            scroll={false}
                            href={`/${locale}/fixed-costs?edit=${encodeURIComponent(r.id)}`}
                            className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "rounded-full")}
                          >
                            {tx("recurringEdit")}
                          </Link>
                          <form action={deleteRecurring}>
                            <input type="hidden" name="locale" value={locale} />
                            <input type="hidden" name="id" value={r.id} />
                            <Button type="submit" variant="secondary" size="sm" className="rounded-full">
                              {common("delete")}
                            </Button>
                          </form>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
