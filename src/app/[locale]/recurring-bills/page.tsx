import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import type { Locale } from "@/i18n/locales";
import { transactionsAuthReturnPath } from "@/lib/auth-return-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { firstSearchParam, uuidsEqual } from "@/lib/url-search-params";

async function deleteRecurring(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  const locale = String(formData.get("locale") ?? "en") as Locale;
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect(`/${locale}/recurring-bills?error=invalid`);

  const { error } = await supabase.from("recurring_bills").delete().eq("id", id).eq("user_id", data.user.id);
  if (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "PGRST205") redirect(`/${locale}/recurring-bills?error=unavailable`);
    redirect(`/${locale}/recurring-bills?error=unknown`);
  }
  redirect(`/${locale}/recurring-bills?success=deleted`);
}

async function updateRecurring(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  const locale = String(formData.get("locale") ?? "en") as Locale;
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect(`/${locale}/recurring-bills?error=invalid`);

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

  const cadenceOk = cadence === "daily" || cadence === "monthly" || cadence === "quarterly" || cadence === "yearly";
  const typeOk = type === "expense" || type === "income";
  const endDate = endDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(endDateRaw) ? endDateRaw : null;
  const monthOfYear = Number.isFinite(monthRaw) ? Math.max(1, Math.min(12, Math.floor(monthRaw))) : null;
  const dom = Number.isFinite(dayRaw) ? Math.max(1, Math.min(28, Math.floor(dayRaw))) : null;

  if (!Number.isFinite(amountRaw) || amountRaw <= 0 || !typeOk || !category || !cadenceOk) {
    redirect(`/${locale}/recurring-bills?error=invalid`);
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
      month_of_year: (cadence === "quarterly" || cadence === "yearly") ? (monthOfYear ?? 5) : null,
      day_of_month: cadence === "daily" ? null : (dom ?? 5),
      end_date: endDate,
    })
    .eq("id", id)
    .eq("user_id", data.user.id);

  if (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "PGRST205") redirect(`/${locale}/recurring-bills?error=unavailable`);
    redirect(`/${locale}/recurring-bills?error=unknown`);
  }

  redirect(`/${locale}/recurring-bills?success=updated`);
}

export default async function RecurringBillsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: raw } = await params;
  const locale = (raw === "zh" ? "zh" : "en") as Locale;
  const nav = await getTranslations("nav");
  const t = await getTranslations("transactions");
  const common = await getTranslations("common");
  const sp = searchParams ? await searchParams : {};
  const editParam = firstSearchParam(sp.edit)?.trim();

  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    const returnTo = transactionsAuthReturnPath(locale, {});
    redirect(`/${locale}/auth?next=${encodeURIComponent(returnTo)}`);
  }

  const { data: rows, error } = await supabase
    .from("recurring_bills")
    .select("id,amount,currency,fx_rate,type,category,note,cadence,month_of_year,day_of_month,end_date,created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  const unavailable = (error as { code?: string } | null)?.code === "PGRST205";
  if (error && !unavailable) redirect(`/${locale}/recurring-bills?error=unknown`);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("recurringManageTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("recurringManageSubtitle")}</p>
        </div>
        <Link href={`/${locale}/transactions`} className={cn(buttonVariants({ variant: "secondary" }), "rounded-full")}>
          {nav("transactions")}
        </Link>
      </div>

      <div className="rounded-2xl border bg-white/70 p-6">
        {unavailable ? (
          <div className="text-sm text-muted-foreground">{t("errorRecurringUnavailable")}</div>
        ) : rows?.length ? (
          <div className="space-y-3">
            {rows.map((r) => (
              editParam && uuidsEqual(editParam, String(r.id)) ? (
                <form key={r.id} action={updateRecurring} className="rounded-xl border bg-white p-4">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={r.id} />
                  <div className="grid gap-4 sm:grid-cols-4">
                    <div className="space-y-2">
                      <Label htmlFor={`amount-${r.id}`}>{t("amount")}</Label>
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
                      <Label htmlFor={`cur-${r.id}`}>{t("currency")}</Label>
                      <Input id={`cur-${r.id}`} name="currency" defaultValue={String(r.currency ?? "USD")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`fx-${r.id}`}>{t("fxRateToUsd")}</Label>
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
                      <Label htmlFor={`type-${r.id}`}>{t("typeLabel")}</Label>
                      <select
                        id={`type-${r.id}`}
                        name="type"
                        defaultValue={r.type === "income" ? "income" : "expense"}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="expense">{t("typeExpense")}</option>
                        <option value="income">{t("typeIncome")}</option>
                      </select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor={`cat-${r.id}`}>{t("category")}</Label>
                      <Input id={`cat-${r.id}`} name="category" defaultValue={String(r.category ?? "")} required />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor={`note-${r.id}`}>{t("note")}</Label>
                      <Input id={`note-${r.id}`} name="note" defaultValue={String(r.note ?? "")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`cad-${r.id}`}>{t("recurringCadence")}</Label>
                      <select
                        id={`cad-${r.id}`}
                        name="cadence"
                        defaultValue={String(r.cadence)}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="daily">{t("recurringDaily")}</option>
                        <option value="monthly">{t("recurringMonthly")}</option>
                        <option value="quarterly">{t("recurringQuarterly")}</option>
                        <option value="yearly">{t("recurringYearly")}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`moy-${r.id}`}>{t("recurringMonthOfYear")}</Label>
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
                      <Label htmlFor={`dom-${r.id}`}>{t("recurringDayOfMonth")}</Label>
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
                      <Label htmlFor={`end-${r.id}`}>{t("recurringEndDate")}</Label>
                      <Input id={`end-${r.id}`} name="end_date" type="date" defaultValue={r.end_date ?? ""} />
                    </div>
                    <div className="flex flex-wrap gap-2 sm:col-span-4">
                      <Button type="submit" size="sm" className="rounded-full">
                        {common("save")}
                      </Button>
                      <Link
                        scroll={false}
                        href={`/${locale}/recurring-bills`}
                        className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "rounded-full")}
                      >
                        {common("cancel")}
                      </Link>
                    </div>
                  </div>
                </form>
              ) : (
                <div key={r.id} className="flex flex-col gap-2 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm">
                    <div className="font-medium">
                      {r.type === "income" ? "+" : "-"}
                      {Number(r.amount).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      · {String(r.category ?? "")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("recurringCadenceLabel")}: {String(r.cadence)}
                      {(r.cadence === "quarterly" || r.cadence === "yearly") && r.month_of_year
                        ? ` · ${t("recurringMonthInYear", { n: r.month_of_year })}`
                        : ""}
                      {r.day_of_month ? ` · ${t("recurringDayShort", { n: r.day_of_month })}` : ""}
                      {r.end_date ? ` · ${t("recurringEndShort", { d: r.end_date })}` : ""}
                    {r.currency && String(r.currency).toUpperCase() !== "USD" ? ` · ${String(r.currency)}` : ""}
                      {r.note ? ` · ${r.note}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      scroll={false}
                      href={`/${locale}/recurring-bills?edit=${encodeURIComponent(r.id)}`}
                      className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "rounded-full")}
                    >
                      {t("recurringEdit")}
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
              )
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">{t("recurringEmpty")}</div>
        )}
      </div>
    </div>
  );
}

