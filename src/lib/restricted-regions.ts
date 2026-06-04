import type { NextRequest } from "next/server";

/**
 * ISO 3166-1 alpha-2 codes for jurisdictions we block at the edge.
 * Align with Terms § Sanctions; extend via GEO_BLOCK_COUNTRIES env (comma-separated).
 * Default covers common comprehensive / high-risk programs (not exhaustive).
 */
export const DEFAULT_BLOCKED_COUNTRY_CODES = [
  "CU", // Cuba
  "IR", // Iran
  "KP", // North Korea
  "SY", // Syria
  "RU", // Russia (broad restrictions)
  "BY", // Belarus
] as const;

function parseCountryList(raw: string | undefined): Set<string> {
  if (!raw?.trim()) {
    return new Set(DEFAULT_BLOCKED_COUNTRY_CODES);
  }
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => /^[A-Z]{2}$/.test(s)),
  );
}

const blockedCountries = parseCountryList(process.env.GEO_BLOCK_COUNTRIES);

export function isGeoBlockEnabled(): boolean {
  const v = process.env.GEO_BLOCK_ENABLED?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off") return false;
  return true;
}

/** Resolve visitor country from CDN / platform headers (Vercel, Cloudflare). */
export function getCountryFromRequest(request: NextRequest): string | null {
  const raw =
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("cf-ipcountry") ??
    request.headers.get("x-country-code");
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

export function isBlockedCountry(country: string | null): boolean {
  if (!country) return false;
  if (country === "XX" || country === "T1") return false;
  return blockedCountries.has(country);
}

export function shouldBlockRequest(request: NextRequest): { block: boolean; country: string | null } {
  if (!isGeoBlockEnabled()) return { block: false, country: null };
  const country = getCountryFromRequest(request);
  return { block: isBlockedCountry(country), country };
}

export function blockedCountryListForDisplay(): string[] {
  return [...blockedCountries].sort();
}
