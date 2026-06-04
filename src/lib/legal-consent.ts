import { LEGAL_POLICY_VERSION } from "@/lib/site";

export const PENDING_LEGAL_CONSENT_KEY = "kapi_pending_legal_consent";
export const PENDING_LEGAL_CONSENT_COOKIE = "kapi_pending_legal_consent";

export type PendingLegalConsent = {
  version: string;
  acceptedAt: string;
  sanctionsAttested?: boolean;
};

export function buildPendingLegalConsent(opts?: { sanctionsAttested?: boolean }): PendingLegalConsent {
  return {
    version: LEGAL_POLICY_VERSION,
    acceptedAt: new Date().toISOString(),
    ...(opts?.sanctionsAttested ? { sanctionsAttested: true } : {}),
  };
}

function parsePending(raw: string): PendingLegalConsent | null {
  try {
    const parsed = JSON.parse(raw) as PendingLegalConsent;
    if (typeof parsed.version !== "string" || typeof parsed.acceptedAt !== "string") return null;
    if (parsed.version !== LEGAL_POLICY_VERSION) return null;
    return {
      version: parsed.version,
      acceptedAt: parsed.acceptedAt,
      ...(parsed.sanctionsAttested === true ? { sanctionsAttested: true } : {}),
    };
  } catch {
    return null;
  }
}

/** Stash in sessionStorage + cookie (cookie survives email-confirm links in a new tab). */
export function stashPendingLegalConsent(opts?: { sanctionsAttested?: boolean }): void {
  if (typeof window === "undefined") return;
  const payload = buildPendingLegalConsent(opts);
  const encoded = JSON.stringify(payload);
  sessionStorage.setItem(PENDING_LEGAL_CONSENT_KEY, encoded);
  document.cookie = `${PENDING_LEGAL_CONSENT_COOKIE}=${encodeURIComponent(encoded)}; path=/; max-age=3600; SameSite=Lax`;
}

export function readPendingLegalConsent(): PendingLegalConsent | null {
  if (typeof window === "undefined") return null;
  const fromSession = sessionStorage.getItem(PENDING_LEGAL_CONSENT_KEY);
  if (fromSession) {
    const parsed = parsePending(fromSession);
    if (parsed) return parsed;
  }
  const match = document.cookie.match(new RegExp(`(?:^|; )${PENDING_LEGAL_CONSENT_COOKIE}=([^;]*)`));
  if (!match?.[1]) return null;
  try {
    return parsePending(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

export function clearPendingLegalConsent(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PENDING_LEGAL_CONSENT_KEY);
  document.cookie = `${PENDING_LEGAL_CONSENT_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

/** Parse pending consent from OAuth callback cookie (server). */
export function parsePendingLegalConsentCookie(raw: string | undefined): PendingLegalConsent | null {
  if (!raw) return null;
  try {
    return parsePending(decodeURIComponent(raw));
  } catch {
    return tryParsePendingLegalConsentCookieRaw(raw);
  }
}

function tryParsePendingLegalConsentCookieRaw(raw: string): PendingLegalConsent | null {
  try {
    return parsePending(raw);
  } catch {
    return null;
  }
}
