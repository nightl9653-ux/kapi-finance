import { BASE_CURRENCY, formatProjectMoney } from "@/lib/fx";

/** 存入 transactions.sub_category */
export const SOCIAL_MONEY_KINDS = [
  "gift_out",
  "gift_in",
  "lend",
  "borrow",
  "repay_in",
  "repay_out",
] as const;

export type SocialMoneyKind = (typeof SOCIAL_MONEY_KINDS)[number];

export type SocialMoneyFlow = {
  id: string;
  contactId: string;
  kind: SocialMoneyKind;
  amount: number;
  currency: string;
  amountBase: number;
  occurredOn: string;
  note?: string;
  createdAt: string;
};

export type ContactMoneySummary = {
  contactId: string;
  /** USD 本位：正=对方欠我，负=我欠对方 */
  loanBalanceBase: number;
  /** USD 本位：正=收到礼金多于送出 */
  giftNetBase: number;
  count: number;
};

export function isSocialMoneyKind(raw: unknown): raw is SocialMoneyKind {
  return typeof raw === "string" && (SOCIAL_MONEY_KINDS as readonly string[]).includes(raw);
}

export function transactionTypeForKind(kind: SocialMoneyKind): "expense" | "income" {
  switch (kind) {
    case "gift_out":
    case "lend":
    case "repay_out":
      return "expense";
    case "gift_in":
    case "borrow":
    case "repay_in":
      return "income";
  }
}

export function categoryForKind(kind: SocialMoneyKind): string {
  return transactionTypeForKind(kind) === "expense" ? "social" : "gift";
}

/** 借贷余额增量（USD）：正=对方欠我 */
export function loanDeltaBase(kind: SocialMoneyKind, amountBase: number): number {
  const n = Number.isFinite(amountBase) ? amountBase : 0;
  switch (kind) {
    case "lend":
      return n;
    case "repay_in":
      return -n;
    case "borrow":
      return -n;
    case "repay_out":
      return n;
    default:
      return 0;
  }
}

/** 礼金净值增量（USD）：正=我净收到 */
export function giftDeltaBase(kind: SocialMoneyKind, amountBase: number): number {
  const n = Number.isFinite(amountBase) ? amountBase : 0;
  switch (kind) {
    case "gift_in":
      return n;
    case "gift_out":
      return -n;
    default:
      return 0;
  }
}

export function summarizeFlows(flows: SocialMoneyFlow[]): Map<string, ContactMoneySummary> {
  const map = new Map<string, ContactMoneySummary>();
  for (const f of flows) {
    const cur = map.get(f.contactId) ?? {
      contactId: f.contactId,
      loanBalanceBase: 0,
      giftNetBase: 0,
      count: 0,
    };
    cur.loanBalanceBase = round2(cur.loanBalanceBase + loanDeltaBase(f.kind, f.amountBase));
    cur.giftNetBase = round2(cur.giftNetBase + giftDeltaBase(f.kind, f.amountBase));
    cur.count += 1;
    map.set(f.contactId, cur);
  }
  return map;
}

export function emptyMoneySummary(contactId: string): ContactMoneySummary {
  return { contactId, loanBalanceBase: 0, giftNetBase: 0, count: 0 };
}

export function formatUsdBase(amount: number): string {
  return formatProjectMoney(amount, BASE_CURRENCY);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
