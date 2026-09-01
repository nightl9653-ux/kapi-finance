/**
 * 艺术站来源白名单（结账 CORS / 付完款回跳 / 入账通知）。
 * NEXT_PUBLIC_ART_ORIGINS：逗号分隔完整 origin。
 * 始终放行 localhost / 127.0.0.1（任意端口）。
 */

import { getArtPublicUrl, listAllowedArtOrigins } from "@/lib/art-public-url";

export { getArtPublicUrl };

function isLocalDevHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function isAllowedArtOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (isLocalDevHost(u.hostname)) return true;
    const allowed = listAllowedArtOrigins();
    if (allowed.includes(u.origin)) return true;
    return u.origin === new URL(getArtPublicUrl()).origin;
  } catch {
    return false;
  }
}

export function parseAllowedArtOrigin(raw: string | null | undefined): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  try {
    const origin = new URL(value).origin;
    return isAllowedArtOrigin(origin) ? origin : null;
  } catch {
    return null;
  }
}

export function artCorsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin")?.trim() ?? "";
  if (!origin || !isAllowedArtOrigin(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
