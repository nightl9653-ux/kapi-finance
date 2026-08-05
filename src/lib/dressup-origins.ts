/**
 * 宅宴来源白名单（解锁回跳 / 静默核对 postMessage）。
 * 环境变量 NEXT_PUBLIC_DRESSUP_ORIGINS：逗号分隔完整 origin，如
 * https://zhaiyan.example.com,https://www.zhaiyan.example.com
 * 始终放行 localhost / 127.0.0.1（任意端口）。
 */

function isLocalDevHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function parseAllowedOrigins(): string[] {
  const raw = process.env.NEXT_PUBLIC_DRESSUP_ORIGINS?.trim() ?? "";
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

export function isAllowedDressupOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (isLocalDevHost(u.hostname)) return true;
    const allowed = parseAllowedOrigins();
    return allowed.includes(u.origin);
  } catch {
    return false;
  }
}

/** postMessage 时兼容 localhost / 127.0.0.1 互写 */
export function dressupOriginAlternates(origin: string): string[] {
  const out = [origin];
  try {
    const u = new URL(origin);
    if (u.hostname === "localhost") {
      out.push(`${u.protocol}//127.0.0.1${u.port ? `:${u.port}` : ""}`);
    } else if (u.hostname === "127.0.0.1") {
      out.push(`${u.protocol}//localhost${u.port ? `:${u.port}` : ""}`);
    }
  } catch {
    // ignore
  }
  return out;
}
