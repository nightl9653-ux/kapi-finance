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

/** 梦想剧场：故事生成/翻译（服务端）；未配置时相关功能不可用 */
export function getOpenAIDreamConfig(): {
  apiKey: string;
  storyModel: string;
  translateModel: string;
  ttsModel: string;
  ttsVoice: string;
  baseURL?: string;
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
    storyModel: (process.env.OPENAI_DREAM_STORY_MODEL ?? process.env.DMX_DREAM_STORY_MODEL ?? "gpt-4o").trim(),
    translateModel: (process.env.OPENAI_DREAM_TRANSLATE_MODEL ?? process.env.DMX_DREAM_TRANSLATE_MODEL ?? "gpt-4o-mini").trim(),
    ttsModel: (process.env.OPENAI_DREAM_TTS_MODEL ?? process.env.DMX_DREAM_TTS_MODEL ?? "gpt-4o-mini-tts").trim(),
    ttsVoice: (process.env.OPENAI_DREAM_TTS_VOICE ?? process.env.DMX_DREAM_TTS_VOICE ?? "alloy").trim(),
    baseURL: baseURL || undefined,
  };
}

/** DMXAPI：Seedance 视频生成（responses 异步任务）；默认 Base URL 对齐官方文档示例 */
export function getDmxVideoConfig(): {
  apiKey: string;
  baseURL: string;
  submitModel: string;
  getModel: string;
  promptModel: string;
} | null {
  const apiKey =
    process.env.OPENAI_API_KEY?.trim() ??
    process.env.DMX_API_KEY?.trim() ??
    process.env.DMXAPI_API_KEY?.trim();
  if (!apiKey) return null;

  const baseURL =
    (process.env.DMX_VIDEO_BASE_URL ??
      process.env.OPENAI_BASE_URL ??
      process.env.DMX_BASE_URL ??
      process.env.DMXAPI_BASE_URL ??
      ""
    ).trim() || "https://www.dmxapi.com/v1";

  return {
    apiKey,
    baseURL,
    // 国际站默认走 Vidu 2.0（4s×3≈12s 由应用层拼接/连播）
    submitModel: (process.env.DMX_VIDEO_SUBMIT_MODEL ?? "vidu2.0").trim(),
    getModel: (process.env.DMX_VIDEO_GET_MODEL ?? "seedance-get").trim(),
    promptModel: (process.env.DMX_VIDEO_PROMPT_MODEL ?? process.env.OPENAI_SCAN_MODEL ?? "gpt-4o-mini").trim(),
  };
}

/** 梦想剧场：文生图（服务端）；默认使用豆包 Seedream 系列（如可用） */
export function getDreamImageConfig(): {
  apiKey: string;
  baseURL: string;
  model: string;
  ultraModel: string;
} | null {
  const apiKey =
    process.env.OPENAI_API_KEY?.trim() ??
    process.env.DMX_API_KEY?.trim() ??
    process.env.DMXAPI_API_KEY?.trim();
  if (!apiKey) return null;

  const baseURL =
    (process.env.DMX_IMAGE_BASE_URL ??
      process.env.OPENAI_BASE_URL ??
      process.env.DMX_BASE_URL ??
      process.env.DMXAPI_BASE_URL ??
      ""
    ).trim() || "https://www.dmxapi.com/v1";

  return {
    apiKey,
    baseURL,
    /** 未勾选高质量：默认与 `DMX_IMAGE_MODEL_ULTRA` 一致为 GPT Image 2；可用 .env 的 DMX_IMAGE_MODEL 覆盖 */
    model: (process.env.DMX_IMAGE_MODEL ?? "gpt-image-2").trim(),
    /** 勾选高质量：默认同上；可用 DMX_IMAGE_MODEL_ULTRA 指定更强档（若网关区分） */
    ultraModel: (process.env.DMX_IMAGE_MODEL_ULTRA ?? "gpt-image-2").trim(),
  };
}

