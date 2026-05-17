/**
 * Next.js `page` 的 `searchParams` 中，同一键可能出现 `string | string[]`。
 */
export function firstSearchParam(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" ? v : undefined;
}

/** 转为无连字符小写 hex；若非标准 128-bit UUID 则返回 null。 */
export function uuidToCompactHex(value: string): string | null {
  const hex = value.trim().toLowerCase().replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/.test(hex)) return null;
  return hex;
}

/** 比较两个 UUID 字符串（忽略连字符与大小写）。 */
export function uuidsEqual(a: string, b: string): boolean {
  const na = uuidToCompactHex(a);
  const nb = uuidToCompactHex(b);
  return na !== null && nb !== null && na === nb;
}
