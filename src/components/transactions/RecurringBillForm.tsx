"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TransactionCategoryFields } from "@/components/transactions/TransactionCategoryFields";
import { cn } from "@/lib/utils";
import { coerceCurrency } from "@/lib/fx";

type Cadence = "daily" | "monthly" | "quarterly" | "yearly";
type FxMode = "auto" | "manual";

async function fetchRate(from: string, to: string): Promise<number> {
  const res = await fetch(`/api/fx?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; rate?: number };
  if (!res.ok || !data.ok || !Number.isFinite(data.rate) || !data.rate || data.rate <= 0) {
    throw new Error("fx_failed");
  }
  return data.rate;
}

export function RecurringBillForm({
  locale,
  action,
}: {
  locale: string;
  action: (formData: FormData) => void;
}) {
  const t = useTranslations("transactions");
  const common = useTranslations("common");

  const [cadence, setCadence] = useState<Cadence>("monthly");
  const [monthOfYear, setMonthOfYear] = useState("5");
  const [dayOfMonth, setDayOfMonth] = useState("5");
  const [currency, setCurrency] = useState("USD");
  const [fxMode, setFxMode] = useState<FxMode>("auto");
  const [fxRate, setFxRate] = useState("1");
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [displayRate, setDisplayRate] = useState("1"); // 1 USD = ? displayCurrency
  const [amountSnapshot, setAmountSnapshot] = useState<number | null>(null);

  useEffect(() => {
    const el = document.getElementById("rb_amount") as HTMLInputElement | null;
    if (!el) return;
    const onInput = () => {
      const n = Number(el.value);
      setAmountSnapshot(Number.isFinite(n) ? n : null);
    };
    el.addEventListener("input", onInput);
    el.addEventListener("change", onInput);
    onInput();
    return () => {
      el.removeEventListener("input", onInput);
      el.removeEventListener("change", onInput);
    };
  }, []);

  const usdToDisplay = useMemo(() => {
    const n = Number(displayRate);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [displayRate]);

  const fxRateNum = useMemo(() => {
    const n = Number(fxRate);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [fxRate]);

  const amountBase = useMemo(() => {
    const amt = amountSnapshot;
    if (!Number.isFinite(amt ?? NaN) || (amt ?? 0) <= 0) return null;
    if (currency === "USD") return amt!;
    if (!fxRateNum) return null;
    return amt! * fxRateNum;
  }, [amountSnapshot, currency, fxRateNum]);

  const displayAmount = useMemo(() => {
    if (amountBase == null || usdToDisplay == null) return null;
    return amountBase * usdToDisplay;
  }, [amountBase, usdToDisplay]);

  return (
    <div className="rounded-2xl border bg-white/70 p-6">
      <h2 className="text-base font-bold text-yellow-700">{t("recurringManageTitle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("recurringManageSubtitle")}</p>

      <form action={action} className="mt-4 grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="locale" value={locale} />

        <div className="space-y-2">
          <Label htmlFor="rb_amount">{t("amount")}</Label>
          <Input id="rb_amount" name="amount" type="number" min="0.01" step="0.01" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="rb_currency">{t("currency")}</Label>
          <select
            id="rb_currency"
            name="currency"
            value={currency}
            onChange={async (e) => {
              const next = coerceCurrency(e.target.value);
              setCurrency(next);
              if (next === "USD") {
                setFxRate("1");
                return;
              }
              if (fxMode !== "auto") return;
              try {
                const r = await fetchRate(next, "USD");
                setFxRate(String(r));
              } catch {
                setFxRate("");
              }
            }}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="CNY">CNY</option>
            <option value="JPY">JPY</option>
            <option value="GBP">GBP</option>
            <option value="HKD">HKD</option>
            <option value="AUD">AUD</option>
            <option value="CAD">CAD</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rb_type">{t("typeLabel")}</Label>
          <select
            id="rb_type"
            name="type"
            required
            defaultValue="expense"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="expense">{t("typeExpense")}</option>
            <option value="income">{t("typeIncome")}</option>
          </select>
        </div>

        <TransactionCategoryFields typeSelectId="rb_type" defaultType="expense" />

        <div className="space-y-2">
          <Label htmlFor="rb_merchant">
            {t("merchant")}
            <span className="ml-1 text-[11px] text-emerald-700/70">{common("optionalInParens")}</span>
          </Label>
          <Input id="rb_merchant" name="merchant" />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="rb_note">
            {t("note")}
            <span className="ml-1 text-[11px] text-emerald-700/70">{common("optionalInParens")}</span>
          </Label>
          <Input id="rb_note" name="note" placeholder={locale.startsWith("zh") ? "如：5月房租" : "e.g. May rent"} />
        </div>

        <div className="sm:col-span-2 rounded-xl border bg-white p-4">
          <div className="text-base font-bold text-black">{t("recurringToggle")}</div>
          <div className="mt-3 grid gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="rb_cadence">{t("recurringCadence")}</Label>
              <select
                id="rb_cadence"
                name="cadence"
                value={cadence}
                onChange={(e) => {
                  const next = e.target.value as Cadence;
                  setCadence(next);
                  setDayOfMonth((prev) => {
                    if (next === "daily") return "";
                    return prev || "5";
                  });
                  setMonthOfYear((prev) => {
                    if (next === "quarterly" || next === "yearly") return prev || "5";
                    return prev;
                  });
                }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="daily">{t("recurringDaily")}</option>
                <option value="monthly">{t("recurringMonthly")}</option>
                <option value="quarterly">{t("recurringQuarterly")}</option>
                <option value="yearly">{t("recurringYearly")}</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rb_dom">{t("recurringDayOfMonth")}</Label>
              <Input
                id="rb_dom"
                name="day_of_month"
                type="number"
                min="1"
                max="28"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
                disabled={cadence === "daily"}
                placeholder={t("recurringDayPlaceholder")}
              />
            </div>

            {(cadence === "quarterly" || cadence === "yearly") ? (
              <div className="space-y-2">
                <Label htmlFor="rb_month">{t("recurringMonthOfYear")}</Label>
                <Input
                  id="rb_month"
                  name="month_of_year"
                  type="number"
                  min="1"
                  max="12"
                  value={monthOfYear}
                  onChange={(e) => setMonthOfYear(e.target.value)}
                  placeholder={t("recurringMonthPlaceholder")}
                  required
                />
              </div>
            ) : (
              <input type="hidden" name="month_of_year" value="" />
            )}

            <div className="space-y-2">
              <Label htmlFor="rb_end">
                {t("recurringEndDate")}
                <span className="ml-1 text-[11px] text-emerald-700/70">{common("optionalInParens")}</span>
              </Label>
              <Input id="rb_end" name="end_date" type="date" />
            </div>
          </div>
        </div>

        <div className="sm:col-span-2 rounded-xl border bg-white p-4">
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rb_display_currency">{t("fxDisplayCurrency")}</Label>
              <select
                id="rb_display_currency"
                value={displayCurrency}
                onChange={async (e) => {
                  const next = coerceCurrency(e.target.value);
                  setDisplayCurrency(next);
                  if (next === "USD") {
                    setDisplayRate("1");
                    return;
                  }
                  if (fxMode !== "auto") return;
                  try {
                    const r = await fetchRate("USD", next);
                    setDisplayRate(String(r));
                  } catch {
                    setDisplayRate("");
                  }
                }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="CNY">CNY</option>
                <option value="JPY">JPY</option>
                <option value="GBP">GBP</option>
                <option value="HKD">HKD</option>
                <option value="AUD">AUD</option>
                <option value="CAD">CAD</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rb_fx_mode">{t("fxMode")}</Label>
              <select
                id="rb_fx_mode"
                value={fxMode}
                onChange={async (e) => {
                  const next = e.target.value === "manual" ? "manual" : "auto";
                  setFxMode(next);
                  if (next !== "auto") return;

                  // 切回自动汇率：按当前币种重新拉取
                  if (currency === "USD") {
                    setFxRate("1");
                  } else {
                    try {
                      const r = await fetchRate(currency, "USD");
                      setFxRate(String(r));
                    } catch {
                      setFxRate("");
                    }
                  }

                  if (displayCurrency === "USD") {
                    setDisplayRate("1");
                  } else {
                    try {
                      const r = await fetchRate("USD", displayCurrency);
                      setDisplayRate(String(r));
                    } catch {
                      setDisplayRate("");
                    }
                  }
                }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="auto">{t("fxModeAuto")}</option>
                <option value="manual">{t("fxModeManual")}</option>
              </select>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rb_fx">
                {t("fxRateToUsd")}
                <span className="ml-1 text-[11px] text-emerald-700/70">({t("fxRateHint")})</span>
              </Label>
              <Input
                id="rb_fx"
                name="fx_rate"
                type="number"
                min="0"
                step="0.0001"
                value={currency === "USD" ? "1" : fxRate}
                onChange={(e) => setFxRate(e.target.value)}
                disabled={currency === "USD" || fxMode === "auto"}
                required={currency !== "USD"}
                placeholder="1.0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rb_display_rate">
                {t("fxDisplayRateFromUsd")}
                <span className="ml-1 text-[11px] text-emerald-700/70">({t("fxDisplayRateHint")})</span>
              </Label>
              <Input
                id="rb_display_rate"
                type="number"
                min="0"
                step="0.0001"
                value={displayCurrency === "USD" ? "1" : displayRate}
                onChange={(e) => setDisplayRate(e.target.value)}
                disabled={displayCurrency === "USD" || fxMode === "auto"}
                placeholder="1.0"
              />
            </div>
          </div>

          <div className="mt-4 text-sm">
            <div className="text-muted-foreground">{t("fxPreviewTitle")}</div>
            <div className="mt-1 font-medium">
              {displayAmount == null ? (
                <span className="text-muted-foreground">{t("fxPreviewEmpty")}</span>
              ) : (
                <>
                  {displayAmount.toLocaleString("en-US", {
                    style: "currency",
                    currency: displayCurrency,
                    currencyDisplay: "code",
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  {currency !== "USD" && amountBase != null && amountSnapshot != null ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      (USD {amountBase.toFixed(2)} · {currency} {amountSnapshot.toFixed(2)})
                    </span>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" className="rounded-full">
            {t("recurringSave")}
          </Button>
          <Link
            href={`/${locale}/recurring-bills`}
            className={cn(buttonVariants({ variant: "secondary" }), "rounded-full")}
          >
            {t("recurringManageLink")}
          </Link>
        </div>
      </form>
    </div>
  );
}

