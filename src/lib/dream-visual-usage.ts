import type { SupabaseClient } from "@supabase/supabase-js";

import { consumeImageCredits, fetchImageCreditsBalance } from "@/lib/ai-image-credits";
import { isAiUsageColumnMissingError } from "@/lib/ai-usage-column-error";
import {
  DREAM_VISUAL_SHOTS_PER_TASK_HQ,
  DREAM_VISUAL_SHOTS_PER_TASK_STANDARD,
  getAiUsageLimit,
} from "@/lib/ai-usage-limits";
import {
  dreamVisualHqPlusRequiredError,
  dreamVisualHqRateLimitError,
  dreamVisualPlusRequiredError,
  dreamVisualRateLimitError,
} from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export function dreamVisualUsageDateUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function dreamVisualShotsPerTask(highQuality: boolean): number {
  return highQuality ? DREAM_VISUAL_SHOTS_PER_TASK_HQ : DREAM_VISUAL_SHOTS_PER_TASK_STANDARD;
}

export type DreamVisualChargeSource = "daily" | "pack";

async function fetchDailyVisualUsed(
  supabase: SupabaseClient,
  userId: string,
  usageDate: string,
  highQuality: boolean,
): Promise<number | null> {
  const countCol = highQuality ? "dream_visual_hq_count" : "dream_visual_count";
  const { data: row, error } = await supabase
    .from("ai_usage")
    .select(countCol)
    .eq("user_id", userId)
    .eq("date", usageDate)
    .maybeSingle();
  if (error) {
    if (isAiUsageColumnMissingError(error)) return null;
    throw new Error("usage_query_failed");
  }
  return Number(
    highQuality
      ? (row as { dream_visual_hq_count?: number | null } | null)?.dream_visual_hq_count ?? 0
      : (row as { dream_visual_count?: number | null } | null)?.dream_visual_count ?? 0,
  );
}

/** 日限优先；日限用尽且为 Plus 时可用加量包张数 */
export async function resolveDreamVisualChargeSource(
  supabase: SupabaseClient,
  userId: string,
  usageDate: string,
  isPlus: boolean,
  highQuality: boolean,
): Promise<DreamVisualChargeSource> {
  if (highQuality && !isPlus) throw new Error(dreamVisualHqPlusRequiredError);

  const limit = getAiUsageLimit(isPlus, highQuality ? "dreamVisualHq" : "dreamVisual");
  if (!isPlus && limit <= 0) throw new Error(dreamVisualPlusRequiredError);

  const used = await fetchDailyVisualUsed(supabase, userId, usageDate, highQuality);
  if (used === null || used < limit) return "daily";

  if (!isPlus) {
    if (highQuality) throw new Error(dreamVisualHqRateLimitError);
    throw new Error(dreamVisualPlusRequiredError);
  }

  const shots = dreamVisualShotsPerTask(highQuality);
  const credits = await fetchImageCreditsBalance(supabase, userId);
  const packRemaining = highQuality ? credits.hq : credits.standard;
  if (packRemaining >= shots) return "pack";

  if (highQuality) throw new Error(dreamVisualHqRateLimitError);
  throw new Error(dreamVisualRateLimitError);
}

export async function assertDreamVisualQuotaAvailable(
  supabase: SupabaseClient,
  userId: string,
  usageDate: string,
  isPlus: boolean,
  highQuality: boolean,
): Promise<void> {
  await resolveDreamVisualChargeSource(supabase, userId, usageDate, isPlus, highQuality);
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

/** 任务成功启动后扣费：先日限，再加量包 */
export async function chargeDreamVisualTask(
  supabase: SupabaseClient,
  userId: string,
  usageDate: string,
  isPlus: boolean,
  highQuality: boolean,
): Promise<DreamVisualChargeSource> {
  const source = await resolveDreamVisualChargeSource(supabase, userId, usageDate, isPlus, highQuality);
  if (source === "daily") {
    await incrementDreamVisualTaskCount(supabase, userId, usageDate, highQuality);
    return "daily";
  }

  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("credits_write_failed");
  await consumeImageCredits(admin, userId, highQuality, dreamVisualShotsPerTask(highQuality));
  return "pack";
}
