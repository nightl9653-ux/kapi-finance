import type { SupabaseClient } from "@supabase/supabase-js";

import { isAiUsageColumnMissingError } from "@/lib/ai-usage-column-error";
import { getAiUsageLimit } from "@/lib/ai-usage-limits";
import { dreamLocalizedMediaRateLimitError } from "@/lib/env";

export function dreamLocalizedMediaUsageDateUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function assertDreamLocalizedMediaQuotaAvailable(
  supabase: SupabaseClient,
  userId: string,
  usageDate: string,
  isPlus: boolean,
): Promise<void> {
  const limit = getAiUsageLimit(isPlus, "dreamLocalizedMedia");
  const { data: row, error } = await supabase
    .from("ai_usage")
    .select("dream_localized_media_count")
    .eq("user_id", userId)
    .eq("date", usageDate)
    .maybeSingle();
  if (error) {
    if (isAiUsageColumnMissingError(error)) return;
    throw new Error("usage_query_failed");
  }
  const used = Number(
    (row as { dream_localized_media_count?: number | null } | null)?.dream_localized_media_count ?? 0,
  );
  if (used >= limit) throw new Error(dreamLocalizedMediaRateLimitError);
}

export async function incrementDreamLocalizedMediaCount(
  supabase: SupabaseClient,
  userId: string,
  usageDate: string,
): Promise<void> {
  const { data: usageRow, error: usageErr } = await supabase
    .from("ai_usage")
    .select("id, dream_localized_media_count")
    .eq("user_id", userId)
    .eq("date", usageDate)
    .maybeSingle();
  if (usageErr) {
    if (isAiUsageColumnMissingError(usageErr)) return;
    throw new Error("usage_write_failed");
  }

  const row = usageRow as { id?: string; dream_localized_media_count?: number | null } | null;
  const used = Number(row?.dream_localized_media_count ?? 0);
  const nextCount = used + 1;
  if (!row?.id) {
    const { error: insErr } = await supabase.from("ai_usage").insert({
      user_id: userId,
      date: usageDate,
      dream_localized_media_count: nextCount,
    });
    if (insErr) {
      if (isAiUsageColumnMissingError(insErr)) return;
      throw new Error("usage_write_failed");
    }
  } else {
    const { error: upErr } = await supabase
      .from("ai_usage")
      .update({ dream_localized_media_count: nextCount })
      .eq("id", row.id)
      .eq("user_id", userId);
    if (upErr) {
      if (isAiUsageColumnMissingError(upErr)) return;
      throw new Error("usage_write_failed");
    }
  }
}
