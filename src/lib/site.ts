/** Public site identity for metadata, footer, and legal pages. */

export const SITE_NAME_EN = "Kash · Family Finance";
export const SITE_NAME_ZH = "咔账·家庭财务规划";

export const SITE_DESCRIPTION_EN =
  "Family finance planning: goals, transactions, AI receipt scan, voice entry, budgets, and Dream Theater visualizations.";
export const SITE_DESCRIPTION_ZH =
  "家庭财务规划：目标管理、记账、AI 扫单与语音记账、预算与梦想剧场。";

/** Override with NEXT_PUBLIC_SUPPORT_EMAIL in production. */
export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "support@919145.xyz";

/** Canonical production URL (custom domain). Used in metadata when set. */
export function getSiteUrl(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return undefined;
  try {
    return new URL(raw).origin;
  } catch {
    return undefined;
  }
}

export function siteName(locale: "zh" | "en"): string {
  return locale === "zh" ? SITE_NAME_ZH : SITE_NAME_EN;
}

export function siteDescription(locale: "zh" | "en"): string {
  return locale === "zh" ? SITE_DESCRIPTION_ZH : SITE_DESCRIPTION_EN;
}

/** Bump when legal pages change materially; shown at sign-up consent. */
export const LEGAL_POLICY_VERSION = "2026-06-01";
