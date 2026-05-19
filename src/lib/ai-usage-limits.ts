/**
 * 各档每日 AI 额度（次/条）；可被环境变量覆盖，见 parseTierLimit。
 *
 * 文生图成本（你提供的单价）：
 * - 普通：6 张/次 × $0.03 ≈ $0.18/次任务
 * - 高质量：3 张/次 × $0.09 ≈ $0.27/次任务
 * Plus 若每天用满普通 1 + 高质量 1，仅画面约 $0.45/天（~$13.5/月），仍需依赖多数用户用不满；
 * 下列默认额度按「多数用户达不到日上限」+ 控最坏情况兼顾。
 */

/** 与 `dream-theater-actions` 单次任务镜头数一致 */
export const DREAM_VISUAL_SHOTS_PER_TASK_STANDARD = 6;
export const DREAM_VISUAL_SHOTS_PER_TASK_HQ = 3;
export const DREAM_VISUAL_USD_PER_IMAGE_STANDARD = 0.03;
export const DREAM_VISUAL_USD_PER_IMAGE_HQ = 0.09;

/** 若用户每天用满日限额，仅文生图月成本（USD） */
export function estimateDreamVisualMonthlyMaxUsd(limits: Pick<AiUsageLimits, "dreamVisual" | "dreamVisualHq">): number {
  const perDay =
    limits.dreamVisual * DREAM_VISUAL_SHOTS_PER_TASK_STANDARD * DREAM_VISUAL_USD_PER_IMAGE_STANDARD +
    limits.dreamVisualHq * DREAM_VISUAL_SHOTS_PER_TASK_HQ * DREAM_VISUAL_USD_PER_IMAGE_HQ;
  return Math.round(perDay * 30 * 100) / 100;
}
export type AiUsageLimitKey =
  | "scan"
  | "voice"
  | "assistant"
  | "dreamVisual"
  | "dreamVisualHq"
  | "dreamStory"
  | "dreamLocalizedMedia";

export type AiUsageLimits = Record<AiUsageLimitKey, number>;

const FREE_DEFAULTS: AiUsageLimits = {
  scan: 5,
  voice: 3,
  assistant: 20,
  dreamVisual: 0,
  dreamVisualHq: 0,
  dreamStory: 5,
  dreamLocalizedMedia: 5,
};

const PLUS_DEFAULTS: AiUsageLimits = {
  scan: 20,
  voice: 12,
  assistant: 80,
  dreamVisual: 1,
  dreamVisualHq: 1,
  dreamStory: 15,
  dreamLocalizedMedia: 15,
};

const ENV_KEYS: Record<AiUsageLimitKey, { free: string; plus: string }> = {
  scan: { free: "FREE_SCAN_DAILY_LIMIT", plus: "PLUS_SCAN_DAILY_LIMIT" },
  voice: { free: "FREE_VOICE_DAILY_LIMIT", plus: "PLUS_VOICE_DAILY_LIMIT" },
  assistant: { free: "FREE_ASSISTANT_DAILY_LIMIT", plus: "PLUS_ASSISTANT_DAILY_LIMIT" },
  dreamVisual: { free: "FREE_DREAM_VISUAL_DAILY_LIMIT", plus: "PLUS_DREAM_VISUAL_DAILY_LIMIT" },
  dreamVisualHq: { free: "FREE_DREAM_VISUAL_HQ_DAILY_LIMIT", plus: "PLUS_DREAM_VISUAL_HQ_DAILY_LIMIT" },
  dreamStory: { free: "FREE_DREAM_STORY_DAILY_LIMIT", plus: "PLUS_DREAM_STORY_DAILY_LIMIT" },
  dreamLocalizedMedia: {
    free: "FREE_DREAM_LOCALIZED_MEDIA_DAILY_LIMIT",
    plus: "PLUS_DREAM_LOCALIZED_MEDIA_DAILY_LIMIT",
  },
};

function parseTierLimit(envName: string, fallback: number): number {
  const n = Number(process.env[envName]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function buildTierLimits(defaults: AiUsageLimits, tier: "free" | "plus"): AiUsageLimits {
  const out = { ...defaults };
  for (const key of Object.keys(defaults) as AiUsageLimitKey[]) {
    const envName = ENV_KEYS[key][tier];
    out[key] = parseTierLimit(envName, defaults[key]);
  }
  return out;
}

const FREE_LIMITS = buildTierLimits(FREE_DEFAULTS, "free");
const PLUS_LIMITS = buildTierLimits(PLUS_DEFAULTS, "plus");

/** AI 预算生成与助手聊天共用 `assistant_count`，计入 assistant 额度 */
export function getAiUsageLimits(isPlus: boolean): AiUsageLimits {
  return isPlus ? PLUS_LIMITS : FREE_LIMITS;
}

export function getAiUsageLimit(isPlus: boolean, key: AiUsageLimitKey): number {
  return getAiUsageLimits(isPlus)[key];
}
