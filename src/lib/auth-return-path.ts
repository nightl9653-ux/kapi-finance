import type { Locale } from "@/i18n/locales";

import { firstSearchParam, uuidToCompactHex } from "@/lib/url-search-params";

/**
 * 构造登录后返回的站内路径（仅含允许的 query），用于 `auth?next=`。
 */
export function transactionsAuthReturnPath(
  locale: Locale,
  sp: Record<string, string | string[] | undefined>,
): string {
  const p = new URLSearchParams();
  const date = firstSearchParam(sp.date);
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) p.set("date", date);
  const editRaw = firstSearchParam(sp.edit)?.trim();
  if (editRaw && uuidToCompactHex(editRaw)) p.set("edit", editRaw);
  const q = p.toString();
  return `/${locale}/transactions${q ? `?${q}` : ""}`;
}

export function dashboardAuthReturnPath(
  locale: Locale,
  sp: Record<string, string | string[] | undefined>,
): string {
  const p = new URLSearchParams();
  const month = firstSearchParam(sp.month);
  if (month && /^\d{4}-\d{2}$/.test(month)) p.set("month", month);
  const q = p.toString();
  return `/${locale}${q ? `?${q}` : ""}`;
}

const REPORTS_MONTHS = new Set([3, 6, 12, 18, 24]);

export function reportsAuthReturnPath(
  locale: Locale,
  sp: Record<string, string | string[] | undefined>,
): string {
  const p = new URLSearchParams();
  const month = firstSearchParam(sp.month);
  if (month && /^\d{4}-\d{2}$/.test(month)) p.set("month", month);
  const months = firstSearchParam(sp.months);
  const m = months ? parseInt(months, 10) : NaN;
  if (Number.isFinite(m) && REPORTS_MONTHS.has(m)) p.set("months", String(m));
  const q = p.toString();
  return `/${locale}/reports${q ? `?${q}` : ""}`;
}

/** 供客户端 / 回调校验：仅允许同源相对路径，防止开放重定向 */
export function isSafeInternalNextPath(next: string): boolean {
  if (!next.startsWith("/") || next.startsWith("//")) return false;
  if (next.includes("://")) return false;
  return true;
}
