export const ART_TIP_UNIT_PRICE_USD = 2.99;
export const ART_TIP_MIN_UNITS = 1;
export const ART_TIP_MAX_UNITS = 1000;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseArtPostId(raw: unknown): string | null {
  const value = String(raw ?? "").trim().toLowerCase();
  return UUID_RE.test(value) ? value : null;
}

export function parseArtTipUnits(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
  if (!Number.isFinite(n)) return null;
  const units = Math.trunc(n);
  if (units < ART_TIP_MIN_UNITS || units > ART_TIP_MAX_UNITS) return null;
  return units;
}

/** 份数 × $2.99，用分换算避免 2.99*N 浮点误差 */
export function artTipAmountUsd(units: number): number {
  return (units * 299) / 100;
}

export function getArtTipProductId(): string | null {
  return process.env.CREEM_PRODUCT_ID_ART_TIP?.trim() || null;
}
