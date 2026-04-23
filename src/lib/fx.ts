export const BASE_CURRENCY = "USD" as const;

export type Currency = "USD" | "EUR" | "CNY" | "JPY" | "GBP" | "HKD" | "AUD" | "CAD";

export function coerceCurrency(raw: unknown): Currency {
  const v = String(raw ?? "")
    .trim()
    .toUpperCase();
  switch (v) {
    case "USD":
    case "EUR":
    case "CNY":
    case "JPY":
    case "GBP":
    case "HKD":
    case "AUD":
    case "CAD":
      return v;
    default:
      return BASE_CURRENCY;
  }
}

export function computeAmountBase(params: { amount: number; currency: Currency; fxRate: number | null }): {
  amountBase: number;
  fxRate: number;
} {
  if (params.currency === BASE_CURRENCY) {
    return { amountBase: params.amount, fxRate: 1 };
  }
  const r = params.fxRate ?? NaN;
  if (!Number.isFinite(r) || r <= 0) {
    throw new Error("invalid_fx_rate");
  }
  return { amountBase: round2(params.amount * r), fxRate: r };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

