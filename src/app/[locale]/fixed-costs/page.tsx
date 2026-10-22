import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import type { Locale } from "@/i18n/locales";
import { buildFixedCostBoard } from "@/lib/fixed-costs/board";
import { formatCategoryLabel } from "@/lib/transaction-categories";
import {
  loadOverdueDueDates,
  markRecurringOccurrenceOverdue,
  materializeRecurringBills,
  type RecurringBillRow,
} from "@/lib/recurring-bills";
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

async function confirmOccurrenceOverdue(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  const locale = String(formData.get("locale") ?? "en") as Locale;
  const billId = String(formData.get("bill_id") ?? "").trim();
  const dueOn = String(formData.get("due_on") ?? "").trim();

  const result = await markRecurringOccurrenceOverdue({
    supabase,
    userId: data.user.id,
    billId,
    dueOn,
  });

  if (!result.ok) {
    if (result.error === "schema_missing") redirect(`/${locale}/fixed-costs?error=overdue_schema`);
    redirect(`/${locale}/fixed-costs?error=overdue_failed`);
  }
  redirect(`/${locale}/fixed-costs?success=overdue_marked`);
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "posted":
      return "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80";
    case "markedOverdue":
      return "bg-rose-200 text-rose-950 ring-1 ring-rose-300/80";
    case "overdue":
      return "bg-rose-100 text-rose-900 ring-1 ring-rose-200/80";
    case "dueToday":
      return "bg-amber-100 text-amber-950 ring-1 ring-amber-200/80";
    default:
      return "bg-muted text-muted-foreground ring-1 ring-foreground/10";
  }
}

function rowAccentClass(status: string): string {
  switch (status) {
    case "posted":
      return "border-l-4 border-l-emerald-500";
    case "markedOverdue":
    case "overdue":
      return "border-l-4 border-l-rose-500";
    case "dueToday":
      return "border-l-4 border-l-amber-500";
    default:
      return "border-l-4 border-l-transparent";
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
  const flashError = firstSearchParam(sp.error)?.trim();
  const flashSuccess = firstSearchParam(sp.success)?.trim();

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
  const overdueKeys = await loadOverdueDueDates({
    supabase,
    userId: auth.user.id,
    billIds: bills.map((b) => b.id),
  });
  const now = new Date();
  const board = buildFixedCostBoard({
    bills,
    overdueKeys,
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
        <Link href={`/${locale}/transactions`} className={cn(buttonVariants(), "rounded-full")}>
          {t("addBill")}
        </Link>
      </div>

      {flashError === "overdue_schema" ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
          {t("overdueSchemaMissing")}
        </p>
      ) : null}
      {flashError === "overdue_failed" ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {t("overdueMarkFailed")}
        </p>
      ) : null}
      {flashSuccess === "overdue_marked" ? (
        <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-900">
          {t("overdueMarkOk")}
        </p>
      ) : null}

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
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4">
                <p className="text-xs font-medium text-emerald-900">{t("expensePosted")}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-900">
                  {formatProjectMoney(board.expensePostedUsd, "USD")}
                </p>
                <p className="mt-1 text-xs text-emerald-800/80">{t("postedHint")}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("postedPct", { pct: expensePct })}</p>
              </div>
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4">
                <p className="text-xs font-medium text-amber-950">{t("expensePending")}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-amber-950">
                  {formatProjectMoney(board.expensePendingUsd, "USD")}
                </p>
                <p className="mt-1 text-xs text-amber-900/80">{t("pendingHint")}</p>
                {board.expenseOverdueUsd > 0 ? (
                  <p className="mt-1 text-xs font-medium text-rose-700">
                    {t("overdueAmount", { amount: formatProjectMoney(board.expenseOverdueUsd, "USD") })}
                  </p>
                ) : null}
                {board.expenseMarkedOverdueUsd > 0 ? (
                  <p className="mt-1 text-xs font-medium text-rose-800">
                    {t("markedOverdueAmount", {
                      amount: formatProjectMoney(board.expenseMarkedOverdueUsd, "USD"),
                    })}
                  </p>
                ) : null}
              </div>
            </div>
            {board.incomePlannedUsd > 0 ? (
              <div className="rounded-2xl border border-emerald-200/70 border-l-4 border-l-emerald-600 bg-emerald-50/40 px-4 py-3">
                <p className="text-xs font-medium text-emerald-900">{t("incomeTitle")}</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-emerald-900/70">{t("incomePlanned")}</p>
                    <p className="mt-0.5 text-xl font-semibold tabular-nums text-emerald-950">
                      {formatProjectMoney(board.incomePlannedUsd, "USD")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-900/70">{t("incomePosted")}</p>
                    <p className="mt-0.5 text-xl font-semibold tabular-nums text-emerald-950">
                      {formatProjectMoney(board.incomePostedUsd, "USD")}
                    </p>
                  </div>
                </div>
                {board.incomePostedUsd >= board.incomePlannedUsd ? (
                  <p className="mt-2 text-xs font-medium text-emerald-800">{t("incomeComplete")}</p>
                ) : (
                  <p className="mt-2 text-xs font-medium text-amber-900">
                    {t("incomeRemaining", {
                      amount: formatProjectMoney(
                        Math.max(0, board.incomePlannedUsd - board.incomePostedUsd),
                        "USD",
                      ),
                    })}
                  </p>
                )}
              </div>
            ) : null}
          </section>

          <section className="space-y-4">
            <h2 className="text-base font-medium">{t("monthListTitle")}</h2>
            {board.occurrences.length === 0 ? (
              <p className="rounded-2xl border border-dashed bg-white/50 p-6 text-sm text-muted-foreground">
                {t("monthEmpty")}
              </p>
            ) : (
              <>
                {(["pending", "markedOverdue", "posted"] as const).map((group) => {
                  const items =
                    group === "posted"
                      ? board.occurrences.filter((o) => o.status === "posted")
                      : group === "markedOverdue"
                        ? board.occurrences.filter((o) => o.status === "markedOverdue")
                        : board.occurrences.filter(
                            (o) => o.status !== "posted" && o.status !== "markedOverdue",
                          );
                  if (items.length === 0) return null;
                  return (
                    <div key={group} className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground">
                        {group === "posted"
                          ? t("groupPosted")
                          : group === "markedOverdue"
                            ? t("groupMarkedOverdue")
                            : t("groupPending")}
                        <span className="ml-1 tabular-nums">({items.length})</span>
                      </h3>
                      <ul className="overflow-hidden rounded-2xl border bg-white/70">
                        {items.map((o) => (
                          <li
                            key={`${o.billId}-${o.dueOn}`}
                            className={cn(
                              "flex flex-wrap items-start justify-between gap-2 border-b border-foreground/5 px-4 py-3 last:border-b-0",
                              rowAccentClass(o.status),
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={cn(
                                    "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                    statusBadgeClass(o.status),
                                  )}
                                >
                                  {t(`status.${o.status}`)}
                                </span>
                                <span className="text-sm font-medium tabular-nums">{o.dueOn}</span>
                              </div>
                              <p className="mt-1 text-sm">
                                {formatCategoryLabel(o.category, o.type, (k) => tx(k))}
                                {o.note ? (
                                  <span className="text-muted-foreground"> · {o.note}</span>
                                ) : null}
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
                            <div className="flex shrink-0 flex-col items-end gap-2">
                              <p
                                className={cn(
                                  "text-sm font-semibold tabular-nums",
                                  o.type === "income" ? "text-emerald-800" : "",
                                )}
                              >
                                {o.type === "income" ? "+" : "−"}
                                {formatProjectMoney(o.amountUsd, "USD")}
                              </p>
                              {o.canMarkOverdue ? (
                                <form action={confirmOccurrenceOverdue}>
                                  <input type="hidden" name="locale" value={locale} />
                                  <input type="hidden" name="bill_id" value={o.billId} />
                                  <input type="hidden" name="due_on" value={o.dueOn} />
                                  <Button
                                    type="submit"
                                    variant="outline"
                                    size="sm"
                                    className="rounded-full text-rose-800"
                                  >
                                    {o.status === "posted" ? t("markOverdueCancelPost") : t("markOverdue")}
                                  </Button>
                                </form>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </>
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
