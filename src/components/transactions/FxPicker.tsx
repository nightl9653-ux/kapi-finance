"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BASE_CURRENCY, type Currency, coerceCurrency } from "@/lib/fx";

type FxMode = "auto" | "manual";

const CURRENCIES: Currency[] = ["USD", "EUR", "CNY", "JPY", "GBP", "HKD", "AUD", "CAD"];

async function fetchRate(from: string, to: string): Promise<number> {
  const res = await fetch(`/api/fx?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; rate?: number };
  if (!res.ok || !data.ok || !Number.isFinite(data.rate) || !data.rate || data.rate <= 0) {
    throw new Error("fx_failed");
  }
  return data.rate;
}

function readAmount(id: string): number | null {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (!el) return null;
  const n = Number(el.value);
  return Number.isFinite(n) ? n : null;
}

export function FxPicker({
  amountInputId,
  defaultCurrency = BASE_CURRENCY,
}: {
  amountInputId: string;
  defaultCurrency?: Currency;
}) {
  const t = useTranslations("transactions");
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const [fxMode, setFxMode] = useState<FxMode>("auto");
  const [fxRate, setFxRate] = useState<string>(""); // 1 currency = ? USD (non-USD only)
  const [displayCurrency, setDisplayCurrency] = useState<Currency>("USD");
  const [displayRate, setDisplayRate] = useState<string>(""); // 1 USD = ? displayCurrency (non-USD only)
  const [amountSnapshot, setAmountSnapshot] = useState<number | null>(null);

  // IMPORTANT: this component is server-rendered too; don't touch `document` during render.
  // We read the amount from the input only after mount (effect) and keep it in state.
  const amount = amountSnapshot;

  // keep amount in sync for preview
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.getElementById(amountInputId) as HTMLInputElement | null;
    if (!el) return;
    const onInput = () => setAmountSnapshot(readAmount(amountInputId));
    el.addEventListener("input", onInput);
    el.addEventListener("change", onInput);
    onInput();
    return () => {
      el.removeEventListener("input", onInput);
      el.removeEventListener("change", onInput);
    };
  }, [amountInputId]);

  const effectiveFxRate = currency === "USD" ? "1" : fxRate;
  const effectiveDisplayRate = displayCurrency === "USD" ? "1" : displayRate;

  // auto-fetch fxRate for non-USD
  useEffect(() => {
    if (currency === BASE_CURRENCY) return;
    if (fxMode !== "auto") return;
    let cancelled = false;
    fetchRate(currency, "USD")
      .then((r) => {
        if (cancelled) return;
        setFxRate(String(r));
      })
      .catch(() => {
        if (cancelled) return;
        setFxRate("");
      });
    return () => {
      cancelled = true;
    };
  }, [currency, fxMode]);

  // fetch USD->display for preview (auto/manual)
  useEffect(() => {
    if (fxMode !== "auto") return;
    if (displayCurrency === "USD") return;
    let cancelled = false;
    fetchRate("USD", displayCurrency)
      .then((r) => {
        if (cancelled) return;
        setDisplayRate(String(r));
      })
      .catch(() => {
        if (cancelled) return;
        setDisplayRate("");
      });
    return () => {
      cancelled = true;
    };
  }, [displayCurrency, fxMode]);

  const usdToDisplay = useMemo(() => {
    const n = Number(effectiveDisplayRate);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [effectiveDisplayRate]);

  const fxRateNum = useMemo(() => {
    const n = Number(effectiveFxRate);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [effectiveFxRate]);

  const amountBase = useMemo(() => {
    if (!Number.isFinite(amount ?? NaN) || (amount ?? 0) <= 0) return null;
    if (currency === "USD") return amount!;
    if (!fxRateNum) return null;
    return amount! * fxRateNum;
  }, [amount, currency, fxRateNum]);

  const displayAmount = useMemo(() => {
    if (!amountBase || !usdToDisplay) return null;
    return amountBase * usdToDisplay;
  }, [amountBase, usdToDisplay]);

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fx_currency">{t("currency")}</Label>
          <select
            id="fx_currency"
            name="currency"
            value={currency}
            onChange={(e) => setCurrency(coerceCurrency(e.target.value))}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fx_display_currency">{t("fxDisplayCurrency")}</Label>
          <select
            id="fx_display_currency"
            value={displayCurrency}
            onChange={(e) => setDisplayCurrency(coerceCurrency(e.target.value))}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fx_mode">{t("fxMode")}</Label>
          <select
            id="fx_mode"
            value={fxMode}
            onChange={(e) => setFxMode(e.target.value === "manual" ? "manual" : "auto")}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="auto">{t("fxModeAuto")}</option>
            <option value="manual">{t("fxModeManual")}</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fx_rate">
            {t("fxRateToUsd")}
            <span className="ml-1 text-[11px] text-emerald-700/70">({t("fxRateHint")})</span>
          </Label>
          <Input
            id="fx_rate"
            name="fx_rate"
            type="number"
            min="0"
            step="0.0001"
            value={effectiveFxRate}
            onChange={(e) => setFxRate(e.target.value)}
            disabled={currency === "USD" || fxMode === "auto"}
            required={currency !== "USD"}
            placeholder="1.0"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fx_display_rate">
          {t("fxDisplayRateFromUsd")}
          <span className="ml-1 text-[11px] text-emerald-700/70">({t("fxDisplayRateHint")})</span>
        </Label>
        <Input
          id="fx_display_rate"
          type="number"
          min="0"
          step="0.0001"
          value={effectiveDisplayRate}
          onChange={(e) => setDisplayRate(e.target.value)}
          disabled={displayCurrency === "USD" || fxMode === "auto"}
          placeholder="1.0"
        />
      </div>

      <div className="rounded-xl border bg-white p-4 text-sm">
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
              {currency !== "USD" && amountBase != null ? (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  (USD {amountBase.toFixed(2)} · {currency} {amount?.toFixed(2)})
                </span>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

