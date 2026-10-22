/** Public site identity for metadata, footer, and legal pages. */

export const SITE_NAME_EN = "Kash";
export const SITE_NAME_ZH = "咔账";

export const SITE_DESCRIPTION_EN =
  "See what each client still owes, and what a job earned after costs.";
export const SITE_DESCRIPTION_ZH =
  "客户还欠多少，这单扣掉成本赚了多少。";

/** Override with NEXT_PUBLIC_SUPPORT_EMAIL in production. */
export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "support@919145.xyz";

const FORMAT_DETECTION_OFF = { "x-ms-format-detection": "none" } as const;

/** Stops Edge/Windows from turning an address into a mailto link. */
export function formatDetectionOff() {
  return FORMAT_DETECTION_OFF;
}

/** Same address, but Edge will not treat the text as a mail link. */
export function maskedEmail(email: string): string {
  return email.replace("@", "@\u200b");
}

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
export const LEGAL_POLICY_VERSION = "2026-09-11";
