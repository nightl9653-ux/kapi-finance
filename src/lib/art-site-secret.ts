import { timingSafeEqual } from "crypto";

import { getArtPublicUrl } from "@/lib/art-public-url";

export function getArtGrantSecret(): string | null {
  return process.env.ART_GRANT_SECRET?.trim() || null;
}

/** 付款成功后通知艺术站加总额。ART_GRANT_URL 优先，否则 {ART_URL}/api/grant */
export function getArtGrantUrl(): string {
  const explicit = process.env.ART_GRANT_URL?.trim();
  if (explicit) {
    try {
      return new URL(explicit).href;
    } catch {
      // fall through
    }
  }
  return new URL("/api/grant", getArtPublicUrl()).href;
}

/** 艺术站 ↔ 咔账共用 ART_GRANT_SECRET（结账创建 / 入账通知） */
export function verifyArtSiteSecret(authorizationHeader: string | null | undefined): boolean {
  const secret = getArtGrantSecret();
  if (!secret) return false;
  const auth = String(authorizationHeader ?? "").trim();
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return false;
  const a = Buffer.from(secret, "utf8");
  const b = Buffer.from(token, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
