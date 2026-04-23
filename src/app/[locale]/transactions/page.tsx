import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

import type { Locale } from "@/i18n/locales";
import { transactionsAuthReturnPath } from "@/lib/auth-return-path";
import { isSupabaseConfigured, scanReceiptDailyLimit, voiceDailyLimit } from "@/lib/env";
import { coerceTransactionCategory, formatCategoryLabel } from "@/lib/transaction-categories";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { materializeRecurringBills } from "@/lib/recurring-bills";
import { createTransactionsBulk } from "@/lib/server-actions/create-transactions-bulk";
import { coerceCurrency, computeAmountBase } from "@/lib/fx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BulkTransactionsWithScan } from "@/components/transactions/BulkTransactionsWithScan";
import { ClearFlashParams } from "@/components/transactions/ClearFlashParams";
import { LocalCalendarDateHidden } from "@/components/transactions/LocalCalendarDateHidden";
import { RecurringBillForm } from "@/components/transactions/RecurringBillForm";
import { FxPicker } from "@/components/transactions/FxPicker";
import { TransactionCategoryFields } from "@/components/transactions/TransactionCategoryFields";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function isoTimestampToDatetimeLocal(value: string | null | undefined): string {
  if (!value) return "";
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(String(value));
  return m ? `${m[1]}T${m[2]}:${m[3]}` : "";
}

function parseContextDate(formData: FormData): string | undefined {
  const raw = String(formData.get("context_date") ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
}

/** 浏览器提交的本地日历日；无 JS 或篡改时可能缺失，服务端需兜底。 */
function parseLocalCalendarDate(formData: FormData): string | undefined {
  const raw = String(formData.get("local_calendar_date") ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
}

function transactionsSearchPath(locale: Locale, opts: { success?: string; error?: string; date?: string }): string {
  const p = new URLSearchParams();
  if (opts.error) p.set("error", opts.error);
  if (opts.success) p.set("success", opts.success);
  if (opts.date) p.set("date", opts.date);
  const q = p.toString();
  return `/${locale}/transactions${q ? `?${q}` : ""}`;
}

function formatRecordTime(value: string | null | undefined, locale: Locale): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

async function createTransaction(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");

  const locale = String(formData.get("locale") ?? "en") as Locale;
  const contextDate = parseContextDate(formData);
  const amountRaw = Number(formData.get("amount"));
  const type = String(formData.get("type") ?? "");
  const currency = coerceCurrency(formData.get("currency"));
  const fxRateRaw = Number(formData.get("fx_rate") ?? "");
  const category = coerceTransactionCategory(
    type,
    String(formData.get("category_preset") ?? ""),
    String(formData.get("category_custom") ?? ""),
  );
  const subCategory = String(formData.get("sub_category") ?? "").trim();
  const merchant = String(formData.get("merchant") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const recordedAt = String(formData.get("recorded_at") ?? "").trim();
  const localCalendarDate = parseLocalCalendarDate(formData);

  if (
    !Number.isFinite(amountRaw) ||
    amountRaw <= 0 ||
    (type !== "expense" && type !== "income") ||
    !category
  ) {
    redirect(transactionsSearchPath(locale, { error: "invalid", date: contextDate }));
  }

  const ts = recordedAt ? new Date(recordedAt) : new Date();
  if (Number.isNaN(ts.getTime())) {
    redirect(transactionsSearchPath(locale, { error: "invalid", date: contextDate }));
  }

  const occurredOn = recordedAt
    ? recordedAt.split("T")[0]
    : (localCalendarDate ?? new Date().toISOString().slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) {
    redirect(transactionsSearchPath(locale, { error: "invalid", date: contextDate }));
  }

  let amountBase: number;
  let fxRate: number;
  try {
    const out = computeAmountBase({ amount: amountRaw, currency, fxRate: Number.isFinite(fxRateRaw) ? fxRateRaw : null });
    amountBase = out.amountBase;
    fxRate = out.fxRate;
  } catch {
    redirect(transactionsSearchPath(locale, { error: "invalid", date: contextDate }));
  }

  const { error } = await supabase.from("transactions").insert({
    user_id: data.user.id,
    amount: amountRaw,
    currency,
    fx_rate: fxRate,
    amount_base: amountBase,
    type,
    category,
    sub_category: subCategory || null,
    merchant: merchant || null,
    note: note || null,
    occurred_on: occurredOn,
    timestamp: ts.toISOString(),
  });

  if (error) redirect(transactionsSearchPath(locale, { error: "unknown", date: contextDate }));
  revalidatePath(`/${locale}/transactions`);
  revalidatePath(`/${locale}`);
  redirect(transactionsSearchPath(locale, { success: "created", date: contextDate }));
}

async function createRecurringBill(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");

  const locale = String(formData.get("locale") ?? "en") as Locale;
  const amountRaw = Number(formData.get("amount"));
  const type = String(formData.get("type") ?? "");
  const currency = coerceCurrency(formData.get("currency"));
  const fxRateRaw = Number(formData.get("fx_rate") ?? "");
  const category = coerceTransactionCategory(
    type,
    String(formData.get("category_preset") ?? ""),
    String(formData.get("category_custom") ?? ""),
  );
  const merchant = String(formData.get("merchant") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const cadence = String(formData.get("cadence") ?? "").trim();
  const monthRaw = Number(formData.get("month_of_year") ?? "");
  const dayRaw = Number(formData.get("day_of_month") ?? "");
  const endDateRaw = String(formData.get("end_date") ?? "").trim();

  const cadenceOk = cadence === "daily" || cadence === "monthly" || cadence === "quarterly" || cadence === "yearly";
  if (
    !Number.isFinite(amountRaw) ||
    amountRaw <= 0 ||
    (type !== "expense" && type !== "income") ||
    !category ||
    !cadenceOk
  ) {
    redirect(transactionsSearchPath(locale, { error: "invalid" }));
  }

  let fxRate: number;
  try {
    fxRate = computeAmountBase({ amount: amountRaw, currency, fxRate: Number.isFinite(fxRateRaw) ? fxRateRaw : null }).fxRate;
  } catch {
    redirect(transactionsSearchPath(locale, { error: "invalid" }));
  }

  const endDate = endDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(endDateRaw) ? endDateRaw : null;
  const monthOfYear = Number.isFinite(monthRaw) ? Math.max(1, Math.min(12, Math.floor(monthRaw))) : null;
  const dom = Number.isFinite(dayRaw) ? Math.max(1, Math.min(28, Math.floor(dayRaw))) : null;

  const { error: rErr } = await supabase.from("recurring_bills").insert({
    user_id: data.user.id,
    amount: amountRaw,
    currency,
    fx_rate: fxRate,
    type,
    category,
    merchant: merchant || null,
    note: note || null,
    cadence,
    month_of_year: (cadence === "quarterly" || cadence === "yearly") ? (monthOfYear ?? 5) : null,
    day_of_month: cadence === "daily" ? null : (dom ?? 5),
    start_date: new Date().toISOString().slice(0, 10),
    end_date: endDate,
  });
  if (rErr) {
    const code = (rErr as { code?: string } | null)?.code;
    console.error("recurring_bills insert", rErr);
    if (code === "PGRST205") redirect(transactionsSearchPath(locale, { error: "recurring_unavailable" }));
    if (code === "42501") redirect(transactionsSearchPath(locale, { error: "recurring_forbidden" }));
    if (code === "23503") redirect(transactionsSearchPath(locale, { error: "recurring_profile_missing" }));
    redirect(transactionsSearchPath(locale, { error: "recurring_failed" }));
  }

  revalidatePath(`/${locale}/transactions`);
  revalidatePath(`/${locale}`);
  redirect(transactionsSearchPath(locale, { success: "recurring_created" }));
}

async function updateTransaction(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");

  const locale = String(formData.get("locale") ?? "en") as Locale;
  const contextDate = parseContextDate(formData);
  const id = String(formData.get("id") ?? "");
  const amountRaw = Number(formData.get("amount"));
  const type = String(formData.get("type") ?? "");
  const currency = coerceCurrency(formData.get("currency"));
  const fxRateRaw = Number(formData.get("fx_rate") ?? "");
  const category = coerceTransactionCategory(
    type,
    String(formData.get("category_preset") ?? ""),
    String(formData.get("category_custom") ?? ""),
  );
  const subCategory = String(formData.get("sub_category") ?? "").trim();
  const merchant = String(formData.get("merchant") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const recordedAt = String(formData.get("recorded_at") ?? "").trim();
  const localCalendarDate = parseLocalCalendarDate(formData);

  if (
    !id ||
    !Number.isFinite(amountRaw) ||
    amountRaw <= 0 ||
    (type !== "expense" && type !== "income") ||
    !category
  ) {
    redirect(transactionsSearchPath(locale, { error: "invalid", date: contextDate }));
  }

  let amountBase: number;
  let fxRate: number;
  try {
    const out = computeAmountBase({ amount: amountRaw, currency, fxRate: Number.isFinite(fxRateRaw) ? fxRateRaw : null });
    amountBase = out.amountBase;
    fxRate = out.fxRate;
  } catch {
    redirect(transactionsSearchPath(locale, { error: "invalid", date: contextDate }));
  }

  const ts = recordedAt ? new Date(recordedAt) : new Date();
  if (Number.isNaN(ts.getTime())) {
    redirect(transactionsSearchPath(locale, { error: "invalid", date: contextDate }));
  }

  const occurredOn = recordedAt
    ? recordedAt.split("T")[0]
    : (localCalendarDate ?? new Date().toISOString().slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) {
    redirect(transactionsSearchPath(locale, { error: "invalid", date: contextDate }));
  }

  const { error } = await supabase
    .from("transactions")
    .update({
      amount: amountRaw,
      currency,
      fx_rate: fxRate,
      amount_base: amountBase,
      type,
      category,
      sub_category: subCategory || null,
      merchant: merchant || null,
      note: note || null,
      occurred_on: occurredOn,
      timestamp: ts.toISOString(),
    })
    .eq("id", id)
    .eq("user_id", data.user.id);

  if (error) redirect(transactionsSearchPath(locale, { error: "unknown", date: contextDate }));
  revalidatePath(`/${locale}/transactions`);
  revalidatePath(`/${locale}`);
  redirect(transactionsSearchPath(locale, { success: "updated", date: contextDate }));
}

async function deleteTransaction(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");

  const locale = String(formData.get("locale") ?? "en") as Locale;
  const contextDate = parseContextDate(formData);
  const id = String(formData.get("id") ?? "");
  if (!id) redirect(transactionsSearchPath(locale, { error: "invalid", date: contextDate }));

  const { error } = await supabase.from("transactions").delete().eq("id", id).eq("user_id", data.user.id);
  if (error) redirect(transactionsSearchPath(locale, { error: "unknown", date: contextDate }));
  revalidatePath(`/${locale}/transactions`);
  revalidatePath(`/${locale}`);
  redirect(transactionsSearchPath(locale, { success: "deleted", date: contextDate }));
}

export default async function TransactionsPage({
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
  const errorKey = typeof sp.error === "string" ? sp.error : undefined;
  const successKey = typeof sp.success === "string" ? sp.success : undefined;
  const datePrefill = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : undefined;
  const recordedAtDefault = datePrefill ? `${datePrefill}T20:00` : undefined;
  const editIdRaw = typeof sp.edit === "string" ? sp.edit.trim() : "";
  const editId = editIdRaw.length >= 32 ? editIdRaw : undefined;

  if (!isSupabaseConfigured) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">{nav("transactions")}</h1>
          <p className="text-sm text-muted-foreground">{common("supabaseEnvMissing")}</p>
        </div>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    const returnTo = transactionsAuthReturnPath(locale, sp);
    redirect(`/${locale}/auth?next=${encodeURIComponent(returnTo)}`);
  }

  // 自动生成到期的周期性账单（无 cron 的情况下在访问时补齐）
  await materializeRecurringBills({ supabase, userId: auth.user.id });

  const { data: rows, error } = await supabase
    .from("transactions")
    .select("id,amount,currency,fx_rate,amount_base,type,category,sub_category,merchant,note,occurred_on,timestamp,created_at")
    .eq("user_id", auth.user.id)
    .order("timestamp", { ascending: false })
    .limit(100);

  if (error) {
    redirect(`/${locale}/transactions?error=unknown`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{nav("transactions")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle", { scanLimit: scanReceiptDailyLimit, voiceLimit: voiceDailyLimit })}
        </p>
      </div>

      {(errorKey || successKey) ? <ClearFlashParams /> : null}

      {errorKey ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {errorKey === "invalid"
            ? t("errorInvalid")
            : errorKey === "recurring_unavailable"
              ? t("errorRecurringUnavailable")
              : errorKey === "recurring_forbidden"
                ? t("errorRecurringForbidden")
                : errorKey === "recurring_profile_missing"
                  ? t("errorRecurringProfileMissing")
                  : errorKey === "recurring_failed"
                    ? t("errorRecurringFailed")
              : common("error")}
        </div>
      ) : null}

      {successKey ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {successKey === "created"
            ? t("successCreated")
            : successKey === "deleted"
              ? t("successDeleted")
              : successKey === "bulk_created"
                ? t("successBulkCreated")
                : successKey === "updated"
                  ? t("successUpdated")
                  : successKey === "recurring_created"
                    ? t("successRecurringCreated")
                  : null}
        </div>
      ) : null}

      <div className="rounded-2xl border bg-white/70 p-6">
        <h2 className="text-base font-bold text-yellow-700">{t("title")}</h2>
        <form action={createTransaction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          <LocalCalendarDateHidden />
          {datePrefill ? <input type="hidden" name="context_date" value={datePrefill} /> : null}
          <div className="space-y-2">
            <Label htmlFor="amount">{t("amount")}</Label>
            <Input id="amount" name="amount" type="number" min="0.01" step="0.01" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">{t("typeLabel")}</Label>
            <select
              id="type"
              name="type"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              defaultValue="expense"
            >
              <option value="expense">{t("typeExpense")}</option>
              <option value="income">{t("typeIncome")}</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <FxPicker amountInputId="amount" />
          </div>
          <TransactionCategoryFields typeSelectId="type" defaultType="expense" />
          <div className="space-y-2">
            <Label htmlFor="sub_category">
              {t("subCategory")}
              <span className="ml-1 text-[11px] text-emerald-700/70">{common("optionalInParens")}</span>
            </Label>
            <Input id="sub_category" name="sub_category" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="merchant">
              {t("merchant")}
              <span className="ml-1 text-[11px] text-emerald-700/70">{common("optionalInParens")}</span>
            </Label>
            <Input id="merchant" name="merchant" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="recorded_at">
                {t("when")}
                <span className="ml-1 text-[11px] text-emerald-700/70">{common("optionalInParens")}</span>
              </Label>
              <span className="text-right text-xs text-muted-foreground">{t("whenHint")}</span>
            </div>
            <Input id="recorded_at" name="recorded_at" type="datetime-local" defaultValue={recordedAtDefault} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="note">
              {t("note")}
              <span className="ml-1 text-[11px] text-emerald-700/70">{common("optionalInParens")}</span>
            </Label>
            <Input id="note" name="note" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" className="rounded-full">
              {t("add")}
            </Button>
          </div>
        </form>
      </div>

      <BulkTransactionsWithScan
        locale={locale}
        action={createTransactionsBulk}
        prefillDate={datePrefill}
        scanDailyLimit={scanReceiptDailyLimit}
        voiceDailyLimit={voiceDailyLimit}
      />

      <RecurringBillForm locale={locale} action={createRecurringBill} />

      <div className="rounded-2xl border bg-white/70 p-6">
        <h2 className="text-base font-medium">{t("listTitle")}</h2>
        <div className="mt-4 space-y-3">
          {rows?.length ? (
            rows.map((row) =>
              editId === row.id ? (
                <form
                  key={row.id}
                  action={updateTransaction}
                  className="rounded-xl border bg-white p-4"
                >
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={row.id} />
                  <LocalCalendarDateHidden />
                  {datePrefill ? <input type="hidden" name="context_date" value={datePrefill} /> : null}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`edit-amount-${row.id}`}>{t("amount")}</Label>
                      <Input
                        id={`edit-amount-${row.id}`}
                        name="amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        defaultValue={String(row.amount)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`edit-currency-${row.id}`}>{t("currency")}</Label>
                      <Input
                        id={`edit-currency-${row.id}`}
                        name="currency"
                        defaultValue={String(row.currency ?? "USD")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`edit-type-${row.id}`}>{t("typeLabel")}</Label>
                      <select
                        id={`edit-type-${row.id}`}
                        name="type"
                        required
                        defaultValue={row.type === "income" ? "income" : "expense"}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="expense">{t("typeExpense")}</option>
                        <option value="income">{t("typeIncome")}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`edit-fx-${row.id}`}>{t("fxRateToUsd")}</Label>
                      <Input
                        id={`edit-fx-${row.id}`}
                        name="fx_rate"
                        type="number"
                        min="0"
                        step="0.0001"
                        defaultValue={String(row.fx_rate ?? "")}
                      />
                    </div>
                    <TransactionCategoryFields
                      key={row.id}
                      typeSelectId={`edit-type-${row.id}`}
                      defaultType={row.type === "income" ? "income" : "expense"}
                      defaultCategory={String(row.category ?? "")}
                      categoryCustomId={`edit-cat-custom-${row.id}`}
                    />
                    <div className="space-y-2">
                      <Label htmlFor={`edit-sub-${row.id}`}>
                        {t("subCategory")}
                        <span className="ml-1 text-[11px] text-emerald-700/70">{common("optionalInParens")}</span>
                      </Label>
                      <Input id={`edit-sub-${row.id}`} name="sub_category" defaultValue={row.sub_category ?? ""} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`edit-merchant-${row.id}`}>
                        {t("merchant")}
                        <span className="ml-1 text-[11px] text-emerald-700/70">{common("optionalInParens")}</span>
                      </Label>
                      <Input id={`edit-merchant-${row.id}`} name="merchant" defaultValue={row.merchant ?? ""} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor={`edit-when-${row.id}`}>
                          {t("when")}
                          <span className="ml-1 text-[11px] text-emerald-700/70">{common("optionalInParens")}</span>
                        </Label>
                        <span className="text-right text-xs text-muted-foreground">{t("whenHint")}</span>
                      </div>
                      <Input
                        id={`edit-when-${row.id}`}
                        name="recorded_at"
                        type="datetime-local"
                        defaultValue={isoTimestampToDatetimeLocal(row.timestamp as string)}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor={`edit-note-${row.id}`}>
                        {t("note")}
                        <span className="ml-1 text-[11px] text-emerald-700/70">{common("optionalInParens")}</span>
                      </Label>
                      <Input id={`edit-note-${row.id}`} name="note" defaultValue={row.note ?? ""} />
                    </div>
                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                      <Button type="submit" size="sm" className="rounded-full">
                        {common("save")}
                      </Button>
                      <Link
                        href={
                          datePrefill
                            ? `/${locale}/transactions?date=${encodeURIComponent(datePrefill)}`
                            : `/${locale}/transactions`
                        }
                        className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "rounded-full")}
                      >
                        {common("cancel")}
                      </Link>
                    </div>
                  </div>
                </form>
              ) : (
                <div
                  key={row.id}
                  className="flex flex-col gap-2 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-medium">
                      {row.type === "income" ? "+" : "-"}
                      {Number(row.amount_base ?? row.amount).toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      {String(row.currency ?? "USD").toUpperCase() !== "USD" ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          (
                          {Number(row.amount).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          {String(row.currency ?? "").toUpperCase()})
                        </span>
                      ) : null}
                      ·{" "}
                      {formatCategoryLabel(String(row.category ?? ""), String(row.type ?? ""), (key) => t(key))}
                      {row.sub_category ? ` / ${row.sub_category}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatRecordTime(row.timestamp as string, locale)}
                      {row.merchant ? ` · ${row.merchant}` : ""}
                      {row.note ? ` · ${row.note}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={(() => {
                        const p = new URLSearchParams();
                        if (datePrefill) p.set("date", datePrefill);
                        p.set("edit", row.id);
                        return `/${locale}/transactions?${p.toString()}`;
                      })()}
                      className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "rounded-full")}
                    >
                      {common("edit")}
                    </Link>
                    <form action={deleteTransaction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={row.id} />
                      {datePrefill ? <input type="hidden" name="context_date" value={datePrefill} /> : null}
                      <Button type="submit" variant="secondary" size="sm" className="rounded-full">
                        {common("delete")}
                      </Button>
                    </form>
                  </div>
                </div>
              ),
            )
          ) : (
            <div className="text-sm text-muted-foreground">{t("empty")}</div>
          )}
        </div>
      </div>
    </div>
  );
}
