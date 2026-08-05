/** 宅宴 → 咔账 导入信封（sessionStorage / URL hash） */
export const DRESSUP_IMPORT_STORAGE_KEY = "kapi-dressup-import";

export type DressupImportKind = "house" | "banquet";

export interface DressupImportEnvelope {
  kind: DressupImportKind;
  data: Record<string, unknown>;
  at: number;
}

export function encodeDressupImportPayload(payload: {
  kind: DressupImportKind;
  data: Record<string, unknown>;
}): string {
  const json = JSON.stringify({ ...payload, at: Date.now() });
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeDressupImportPayload(encoded: string): DressupImportEnvelope | null {
  try {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    const binary = atob(padded + pad);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as Partial<DressupImportEnvelope>;
    if (parsed.kind !== "house" && parsed.kind !== "banquet") return null;
    if (!parsed.data || typeof parsed.data !== "object") return null;
    return {
      kind: parsed.kind,
      data: parsed.data as Record<string, unknown>,
      at: typeof parsed.at === "number" ? parsed.at : Date.now(),
    };
  } catch {
    return null;
  }
}

export function stashDressupImport(envelope: DressupImportEnvelope) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(DRESSUP_IMPORT_STORAGE_KEY, JSON.stringify(envelope));
}

/** 取出并清除；可按 kind 过滤 */
export function takeDressupImport(expectedKind?: DressupImportKind): DressupImportEnvelope | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DRESSUP_IMPORT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DressupImportEnvelope;
    if (expectedKind && parsed.kind !== expectedKind) return null;
    sessionStorage.removeItem(DRESSUP_IMPORT_STORAGE_KEY);
    if (parsed.kind !== "house" && parsed.kind !== "banquet") return null;
    if (!parsed.data || typeof parsed.data !== "object") return null;
    return parsed;
  } catch {
    sessionStorage.removeItem(DRESSUP_IMPORT_STORAGE_KEY);
    return null;
  }
}

/** 从当前 URL hash 解析（hash 不含 #） */
export function readDressupImportFromHash(hash: string): DressupImportEnvelope | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  return decodeDressupImportPayload(raw);
}
