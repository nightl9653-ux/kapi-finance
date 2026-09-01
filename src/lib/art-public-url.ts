/**
 * 艺术站公开地址（导航 / 回跳）。不含 Node crypto，可供客户端引用。
 * NEXT_PUBLIC_ART_URL，或 NEXT_PUBLIC_ART_ORIGINS 第一项，否则正式子域名。
 */

const DEFAULT_ART_PUBLIC_URL = "https://beauty.919145.xyz";

function parseAllowedOrigins(): string[] {
  const raw = process.env.NEXT_PUBLIC_ART_ORIGINS?.trim() ?? "";
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      try {
        return new URL(s).origin;
      } catch {
        return "";
      }
    })
    .filter(Boolean);
}

export function getArtPublicUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_ART_URL?.trim();
  if (explicit) {
    try {
      return new URL(explicit).origin;
    } catch {
      // fall through
    }
  }
  return parseAllowedOrigins()[0] ?? DEFAULT_ART_PUBLIC_URL;
}

export function listAllowedArtOrigins(): string[] {
  return parseAllowedOrigins();
}
