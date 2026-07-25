export const BASE_CURRENCY = "USD" as const;

export type Currency =
  | "USD"
  | "EUR"
  | "CNY"
  | "JPY"
  | "GBP"
  | "HKD"
  | "AUD"
  | "CAD"
  | "KRW"
  | "SGD"
  | "TWD"
  | "THB"
  | "CHF"
  | "SEK"
  | "NOK"
  | "NZD"
  | "INR"
  | "IDR"
  | "MYR"
  | "PHP"
  | "VND";

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
    case "KRW":
    case "SGD":
    case "TWD":
    case "THB":
    case "CHF":
    case "SEK":
    case "NOK":
    case "NZD":
    case "INR":
    case "IDR":
    case "MYR":
    case "PHP":
    case "VND":
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

/** Same set as ledger FxPicker — banquet / renovation project working currency */
export const PROJECT_CURRENCIES: Currency[] = [
  "USD",
  "CNY",
  "EUR",
  "JPY",
  "HKD",
  "GBP",
  "AUD",
  "CAD",
  "KRW",
  "SGD",
  "TWD",
  "THB",
  "CHF",
  "SEK",
  "NOK",
  "NZD",
  "INR",
  "IDR",
  "MYR",
  "PHP",
  "VND",
];

const CURRENCY_SYMBOLS: Partial<Record<Currency, string>> = {
  USD: "$",
  CNY: "¥",
  EUR: "€",
  JPY: "¥",
  GBP: "£",
  HKD: "HK$",
  AUD: "A$",
  CAD: "C$",
  SGD: "S$",
  TWD: "NT$",
  KRW: "₩",
  THB: "฿",
  CHF: "CHF ",
  SEK: "kr",
  NOK: "kr",
  NZD: "NZ$",
  INR: "₹",
  IDR: "Rp",
  MYR: "RM",
  PHP: "₱",
  VND: "₫",
};

export function currencySymbol(currency: Currency | string | null | undefined): string {
  const c = coerceCurrency(currency);
  return CURRENCY_SYMBOLS[c] ?? `${c} `;
}

/** Format list amounts in the project's working currency (not necessarily USD base). */
export function formatProjectMoney(
  amount: number,
  currency: Currency | string | null | undefined,
  opts?: { digits?: number },
): string {
  const digits = opts?.digits ?? 2;
  const n = Number.isFinite(amount) ? amount : 0;
  return `${currencySymbol(currency)}${n.toFixed(digits)}`;
}

/** CSV is often opened directly in Excel; use text-like money to avoid narrow columns showing ####. */
export function formatProjectMoneyForCsv(
  amount: number,
  currency: Currency | string | null | undefined,
  opts?: { digits?: number },
): string {
  const digits = opts?.digits ?? 2;
  const n = Number.isFinite(amount) ? amount : 0;
  return `${coerceCurrency(currency)} ${n.toFixed(digits)}`;
}

/** Server-side FX: 1 `from` = ? `to` (Frankfurter). Falls back to latest if dated request fails. */
export async function fetchFxRate(from: Currency, to: Currency, date?: string | null): Promise<number> {
  if (from === to) return 1;

  const tryOnce = async (datePart: string): Promise<number> => {
    const api = new URL(`https://api.frankfurter.app/${datePart}`);
    api.searchParams.set("from", from);
    api.searchParams.set("to", to);
    const res = await fetch(api.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error("fx_upstream_failed");
    const data = (await res.json().catch(() => null)) as null | { rates?: Record<string, number> };
    const rate = data?.rates?.[to];
    if (!Number.isFinite(rate) || !rate || rate <= 0) throw new Error("fx_bad_rate");
    return rate;
  };

  const datePart = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  if (datePart) {
    try {
      return await tryOnce(datePart);
    } catch {
      // weekend / future / unpublished day → latest
    }
  }
  return tryOnce("latest");
}

