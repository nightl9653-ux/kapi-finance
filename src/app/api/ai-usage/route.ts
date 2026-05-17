import { NextResponse } from "next/server";

import { getAiUsageLimits } from "@/lib/ai-usage-limits";
import { isSupabaseConfigured } from "@/lib/env";
import {
  aiUsageSelectIncludes,
  fetchAiUsageRow,
  type AiUsageSelectTier,
} from "@/lib/fetch-ai-usage-row";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchUserIsPlusMember } from "@/lib/user-plus-membership";

function parseUsageDate(url: URL): string {
  const v = String(url.searchParams.get("usage_date") ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  const usageDate = parseUsageDate(new URL(req.url));
  const isPlus = await fetchUserIsPlusMember(supabase, auth.user.id);
  const limits = getAiUsageLimits(isPlus);

  let usageRow: Record<string, unknown> | null;
  let columns: AiUsageSelectTier;
  try {
    const fetched = await fetchAiUsageRow(supabase, auth.user.id, usageDate);
    usageRow = fetched.row;
    columns = fetched.columns;
  } catch {
    return NextResponse.json({ ok: false, error: "usage_query_failed" }, { status: 500 });
  }

  const scanUsed = Number(usageRow?.screenshot_count ?? 0);
  const voiceUsed = Number(usageRow?.voice_count ?? 0);
  const assistantUsed = aiUsageSelectIncludes(columns, "assistant_count")
    ? Number(usageRow?.assistant_count ?? 0)
    : 0;
  const dreamVisualUsed = aiUsageSelectIncludes(columns, "dream_visual_count")
    ? Number(usageRow?.dream_visual_count ?? 0)
    : 0;
  const dreamStoryUsed = aiUsageSelectIncludes(columns, "dream_story_count")
    ? Number(usageRow?.dream_story_count ?? 0)
    : 0;
  const dreamLocalizedMediaUsed = aiUsageSelectIncludes(columns, "dream_localized_media_count")
    ? Number(usageRow?.dream_localized_media_count ?? 0)
    : 0;
  const dreamVisualHqUsed = aiUsageSelectIncludes(columns, "dream_visual_hq_count")
    ? Number(usageRow?.dream_visual_hq_count ?? 0)
    : 0;
  const dreamVisualHqLimit = isPlus ? limits.dreamVisualHq : 0;

  const pack = (used: number, limit: number) => ({
    used,
    remaining: Math.max(0, limit - used),
    limit,
  });

  return NextResponse.json({
    ok: true,
    usage_date: usageDate,
    tier: isPlus ? "plus" : "free",
    scan: pack(scanUsed, limits.scan),
    voice: pack(voiceUsed, limits.voice),
    assistant: pack(assistantUsed, limits.assistant),
    dream_visual: pack(dreamVisualUsed, limits.dreamVisual),
    dream_visual_hq: pack(dreamVisualHqUsed, dreamVisualHqLimit),
    dream_story: pack(dreamStoryUsed, limits.dreamStory),
    dream_localized_media: pack(dreamLocalizedMediaUsed, limits.dreamLocalizedMedia),
  }, {
    headers: {
      "Cache-Control": "private, max-age=5",
      Vary: "Cookie",
    },
  });
}
