import type { SupabaseClient } from "@supabase/supabase-js";

import { isAiUsageColumnMissingError } from "@/lib/ai-usage-column-error";
import { getAiUsageLimit } from "@/lib/ai-usage-limits";
import {
  dreamVisualHqPlusRequiredError,
  dreamVisualHqRateLimitError,
  dreamVisualPlusRequiredError,
  dreamVisualRateLimitError,
} from "@/lib/env";

export function dreamVisualUsageDateUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function assertDreamVisualQuotaAvailable(
  supabase: SupabaseClient,
  userId: string,
  usageDate: string,
  isPlus: boolean,
  highQuality: boolean,
): Promise<void> {
  if (highQuality) {
    if (!isPlus) throw new Error(dreamVisualHqPlusRequiredError);
    const hqLimit = getAiUsageLimit(true, "dreamVisualHq");
    const { data: row, error } = await supabase
      .from("ai_usage")
      .select("dream_visual_hq_count")
      .eq("user_id", userId)
      .eq("date", usageDate)
      .maybeSingle();
    if (error) {
      if (isAiUsageColumnMissingError(error)) return;
      throw new Error("usage_query_failed");
    }
    const used = Number((row as { dream_visual_hq_count?: number | null } | null)?.dream_visual_hq_count ?? 0);
    if (used >= hqLimit) throw new Error(dreamVisualHqRateLimitError);
    return;
  }

  const limit = getAiUsageLimit(isPlus, "dreamVisual");
  if (!isPlus && limit <= 0) throw new Error(dreamVisualPlusRequiredError);
  const { data: row, error } = await supabase
    .from("ai_usage")
    .select("dream_visual_count")
    .eq("user_id", userId)
    .eq("date", usageDate)
    .maybeSingle();
  if (error) {
    if (isAiUsageColumnMissingError(error)) return;
    throw new Error("usage_query_failed");
  }
  const used = Number((row as { dream_visual_count?: number | null } | null)?.dream_visual_count ?? 0);
  if (used >= limit) throw new Error(dreamVisualRateLimitError);
}

export async function incrementDreamVisualTaskCount(
  supabase: SupabaseClient,
  userId: string,
  usageDate: string,
  highQuality: boolean,
): Promise<void> {
  const countCol = highQuality ? "dream_visual_hq_count" : "dream_visual_count";

  const { data: usageRow, error: usageErr } = await supabase
    .from("ai_usage")
    .select(`id, ${countCol}`)
    .eq("user_id", userId)
    .eq("date", usageDate)
    .maybeSingle();
  if (usageErr) {
    if (isAiUsageColumnMissingError(usageErr)) return;
    throw new Error("usage_write_failed");
  }

  const row = usageRow as { id?: string; dream_visual_count?: number | null; dream_visual_hq_count?: number | null } | null;
  const used = Number(highQuality ? (row?.dream_visual_hq_count ?? 0) : (row?.dream_visual_count ?? 0));
  const nextCount = used + 1;
  const patch = highQuality ? { dream_visual_hq_count: nextCount } : { dream_visual_count: nextCount };

  if (!row?.id) {
    const { error: insErr } = await supabase.from("ai_usage").insert({
      user_id: userId,
      date: usageDate,
      ...patch,
    });
    if (insErr) {
      if (isAiUsageColumnMissingError(insErr)) return;
      throw new Error("usage_write_failed");
    }
  } else {
    const { error: upErr } = await supabase.from("ai_usage").update(patch).eq("id", row.id).eq("user_id", userId);
    if (upErr) {
      if (isAiUsageColumnMissingError(upErr)) return;
      throw new Error("usage_write_failed");
    }
  }
}
