import type { SupabaseClient } from "@supabase/supabase-js";

import { isAiUsageColumnMissingError } from "@/lib/ai-usage-column-error";

const AI_USAGE_SELECT_TIERS = [
  "screenshot_count, voice_count, assistant_count, dream_visual_count, dream_visual_hq_count, dream_story_count, dream_localized_media_count",
  "screenshot_count, voice_count, dream_visual_count, dream_story_count, dream_localized_media_count",
  "screenshot_count, voice_count, dream_visual_count, dream_story_count",
  "screenshot_count, voice_count",
] as const;

export type AiUsageSelectTier = (typeof AI_USAGE_SELECT_TIERS)[number];

export function aiUsageSelectIncludes(columns: AiUsageSelectTier, field: string): boolean {
  return columns.split(",").some((c) => c.trim() === field);
}

/** 按列从多到少尝试查询，兼容尚未执行全部迁移的 ai_usage 表 */
export async function fetchAiUsageRow(
  supabase: SupabaseClient,
  userId: string,
  usageDate: string,
): Promise<{ row: Record<string, unknown> | null; columns: AiUsageSelectTier }> {
  for (const columns of AI_USAGE_SELECT_TIERS) {
    const { data, error } = await supabase
      .from("ai_usage")
      .select(columns)
      .eq("user_id", userId)
      .eq("date", usageDate)
      .maybeSingle();
    if (!error) {
      return { row: (data as Record<string, unknown> | null) ?? null, columns };
    }
    if (!isAiUsageColumnMissingError(error)) {
      throw new Error("usage_query_failed");
    }
  }
  throw new Error("usage_query_failed");
}
