function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// IMPORTANT:
// In Next.js client bundles, only static `process.env.NEXT_PUBLIC_*` accesses are inlined.
// Dynamic lookups like `process.env[name]` will be `undefined` in the browser.
const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const env = {
  get NEXT_PUBLIC_SUPABASE_URL() {
    return required(NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
  },
  get NEXT_PUBLIC_SUPABASE_ANON_KEY() {
    return required(NEXT_PUBLIC_SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
};

export const isSupabaseConfigured = Boolean(NEXT_PUBLIC_SUPABASE_URL) && Boolean(NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** 扫单每日次数上限（服务端；默认 10） */
export const scanReceiptDailyLimit = (() => {
  const n = Number(process.env.SCAN_RECEIPT_DAILY_LIMIT ?? "10");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 10;
})();

/** 语音记账每日次数上限（服务端；默认 5） */
export const voiceDailyLimit = (() => {
  const n = Number(process.env.VOICE_DAILY_LIMIT ?? "5");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 5;
})();

export const scanOcrProvider = (() => {
  const v = String(process.env.SCAN_OCR_PROVIDER ?? "openai").trim().toLowerCase();
  return v === "tesseract" ? "tesseract" : "openai";
})();

/** OpenAI 扫单；未配置时 API 返回 503 */
export function getOpenAIScanConfig(): {
  apiKey: string;
  model: string;
  baseURL?: string;
  transcribeModel: string;
} | null {
  const apiKey =
    process.env.OPENAI_API_KEY?.trim() ??
    process.env.DMX_API_KEY?.trim() ??
    process.env.DMXAPI_API_KEY?.trim();
  if (!apiKey) return null;
  const baseURL =
    process.env.OPENAI_BASE_URL?.trim() ??
    process.env.DMX_BASE_URL?.trim() ??
    process.env.DMXAPI_BASE_URL?.trim();

  return {
    apiKey,
    model: (process.env.OPENAI_SCAN_MODEL ?? process.env.DMX_SCAN_MODEL ?? "gpt-4o-mini").trim(),
    baseURL: baseURL || undefined,
    // 兼容性优先：whisper-1 在多数 OpenAI-compatible 网关可用
    transcribeModel: (process.env.OPENAI_TRANSCRIBE_MODEL ?? process.env.DMX_TRANSCRIBE_MODEL ?? "whisper-1").trim(),
  };
}

