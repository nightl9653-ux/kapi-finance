"use server";

import crypto from "crypto";
import OpenAI from "openai";
import { Buffer } from "buffer";

import type { Locale } from "@/i18n/locales";
import { getDreamImageConfig, getDmxVideoConfig, getOpenAIDreamConfig } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  dmxPostResponses,
  dmxGetVideoById,
  dmxPostVideos,
  extractAnyVideoUrls,
  extractVideoId,
  extractSeedanceTaskId,
  parseSeedanceGetResult,
} from "@/lib/dmx/seedance-responses";

type GoalRow = {
  id: string;
  user_id: string;
  name: string | null;
  type: string | null;
  target_amount: number | null;
  current_amount: number | null;
  deadline: string | null;
};

const GOAL_MEDIA_BUCKET = "goal-media";
const DREAM_IMAGE_SIZE = "1024x1024" as const;
/** 普通画面镜头数 */
const DREAM_VISUAL_SHOTS = 6 as const;
/** 高质量画面镜头数（更少、更慢） */
const DREAM_VISUAL_SHOTS_HQ = 3 as const;

function dreamVisualShotTarget(highQuality: boolean): number {
  return highQuality ? DREAM_VISUAL_SHOTS_HQ : DREAM_VISUAL_SHOTS;
}

/** 同一张补图连续失败超过此次数再标 job 为 failed，避免只出 1 张就整单失败 */
const DREAM_VISUAL_MAX_REFRESH_FAILS = 8 as const;

/**
 * 写入 `goal_videos.provider_task_id` JSON 的 `pb` 字段。升级文生图模板/后处理规则时递增，
 * 使「进行中」任务在读库时丢弃旧 prompts，补镜头前整批重算，避免长期沿用旧英文句。
 */
const DREAM_VISUAL_PROMPT_BUILD_ID = 13 as const;

/** 设为 "1" 时沿用固定「安家」英文镜头（更稳）；默认关闭以提升多样性 */
function isDeterministicHomeShotsEnabled(): boolean {
  return String(process.env.DREAM_VISUAL_USE_DETERMINISTIC_HOME ?? "").trim() === "1";
}

/** 追加到兜底分镜末尾，降低「每张都像同一客厅」的概率 */
function diversityStyleJitter(): string {
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]!;
  const moods = ["quiet calm", "warm inviting", "airy luminous", "moody subdued", "crisp editorial"] as const;
  const palettes = [
    "warm walnut and cream plaster",
    "cool gray oak and matte black accents",
    "soft sage olive with linen whites",
    "sunlit birch and brushed brass",
    "deep navy trim with sandstone walls",
    "terra cotta ceramics with ivory walls",
  ] as const;
  const spaces = [
    "different focal wall treatment",
    "distinct window proportions",
    "different focal furniture silhouette",
    "alternate floor finish",
    "different skyline context",
    "different greenery density",
  ] as const;
  const seed = crypto.randomBytes(3).toString("hex");
  return `variety_${seed}: mood ${pick(moods)}, palette ${pick(palettes)}, vary ${pick(spaces)}`;
}

function normalizeKeywords(v: string[]): string[] {
  const out = v
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .map((s) => s.replace(/\s+/g, " "));

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const k of out) {
    const key = k.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(k);
  }
  deduped.sort((a, b) => a.localeCompare(b));
  return deduped;
}

function hashInputs(parts: unknown): string {
  const json = JSON.stringify(parts);
  return crypto.createHash("sha256").update(json).digest("hex");
}

function buildStorySystemPrompt(locale: Locale): string {
  const zh = locale === "zh";
  return zh
    ? [
        "你是一位理财生活规划师，擅长用具体而温柔的画面鼓励用户长期储蓄与规划。",
        "你将基于用户的财务目标信息与关键词，写一段实现目标后的生活场景小作文。",
        "写作要求：",
        "- 先肯定用户的努力与坚持（不要说教）。",
        "- 画面感强、具体、可感知（场景/动作/气味/光线/陪伴等）。",
        "- 最后一段轻轻对比“如果没有规划可能会怎样”，但语气要温和，不要恐吓。",
        "- 长度约 250–400 字。",
        "- 只输出正文，不要标题，不要列表，不要 markdown。",
      ].join("\n")
    : [
        "You are a financial life planner who encourages users with vivid, concrete imagery.",
        "Based on the goal details and user keywords, write a short dream story about life after achieving the goal.",
        "Requirements:",
        "- Affirm the user's effort (no preaching).",
        "- Vivid, sensory, specific scenes.",
        "- End with a gentle contrast: what life might look like without planning (no fear-mongering).",
        "- Length: about 180–260 words.",
        "- Output body text only. No title, no bullets, no markdown.",
      ].join("\n");
}

function buildStoryUserPrompt(params: {
  locale: Locale;
  goalName: string;
  goalType: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string | null;
  keywords: string[];
  freeText?: string;
}): string {
  const zh = params.locale === "zh";
  const deadlinePart = params.deadline ? (zh ? `截止日期：${params.deadline}` : `Deadline: ${params.deadline}`) : "";
  const free = String(params.freeText ?? "").trim();
  return zh
    ? [
        "目标信息：",
        `- 目标名称：${params.goalName}`,
        `- 目标类型：${params.goalType}`,
        `- 目标金额：${params.targetAmount}`,
        `- 当前储蓄：${params.currentAmount}`,
        deadlinePart ? `- ${deadlinePart}` : "",
        "",
        `关键词：${params.keywords.join("、") || "（无）"}`,
        free ? `补充描述：${free}` : "",
        "",
        "请直接输出小作文正文。",
      ]
        .filter(Boolean)
        .join("\n")
    : [
        "Goal context:",
        `- Name: ${params.goalName}`,
        `- Type: ${params.goalType}`,
        `- Target amount: ${params.targetAmount}`,
        `- Saved so far: ${params.currentAmount}`,
        deadlinePart ? `- ${deadlinePart}` : "",
        "",
        `Keywords: ${params.keywords.join(", ") || "(none)"}`,
        free ? `Extra notes: ${free}` : "",
        "",
        "Return the story body only.",
      ]
        .filter(Boolean)
        .join("\n");
}

export async function generateStoryForGoal(input: {
  goalId: string;
  selectedKeywords: string[];
  customKeywords: string[];
  freeText?: string;
  locale: Locale;
}): Promise<{ storyId: string; locale: Locale; content: string; cached: boolean }> {
  const cfg = getOpenAIDreamConfig();
  if (!cfg) throw new Error("dream_openai_not_configured");

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");

  const goalId = String(input.goalId ?? "").trim();
  if (!goalId) throw new Error("missing_goal_id");

  const { data: goal, error: goalError } = await supabase
    .from("financial_goals")
    .select("id,user_id,name,type,target_amount,current_amount,deadline")
    .eq("id", goalId)
    .maybeSingle();
  if (goalError || !goal) throw new Error("goal_not_found");
  const g = goal as unknown as GoalRow;
  if (String(g.user_id) !== auth.user.id) throw new Error("forbidden");

  const locale = input.locale === "zh" ? "zh" : ("en" as Locale);
  const keywords = normalizeKeywords([...(input.selectedKeywords ?? []), ...(input.customKeywords ?? [])]);
  const freeText = String(input.freeText ?? "").trim();

  const inputHash = hashInputs({ goalId, locale, keywords, freeText });

  const { data: cachedRow } = await supabase
    .from("goal_stories")
    .select("id,content,locale")
    .eq("goal_id", goalId)
    .eq("input_hash", inputHash)
    .eq("locale", locale)
    .maybeSingle();

  if (cachedRow?.id && cachedRow?.content) {
    return {
      storyId: String(cachedRow.id),
      locale,
      content: String(cachedRow.content),
      cached: true,
    };
  }

  const client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL, timeout: 90_000 });
  const completion = await client.chat.completions.create({
    model: cfg.storyModel,
    messages: [
      { role: "system", content: buildStorySystemPrompt(locale) },
      {
        role: "user",
        content: buildStoryUserPrompt({
          locale,
          goalName: String(g.name ?? ""),
          goalType: String(g.type ?? ""),
          targetAmount: Number(g.target_amount ?? 0),
          currentAmount: Number(g.current_amount ?? 0),
          deadline: g.deadline,
          keywords,
          freeText,
        }),
      },
    ],
    max_tokens: locale === "zh" ? 800 : 700,
  });

  const content = String(completion.choices[0]?.message?.content ?? "").trim();
  if (!content) throw new Error("empty_completion");

  const { data: inserted, error: insertError } = await supabase
    .from("goal_stories")
    .insert({
      goal_id: goalId,
      input_hash: inputHash,
      keywords,
      free_text: freeText || null,
      locale,
      content,
    })
    .select("id")
    .maybeSingle();

  if (insertError || !inserted?.id) throw new Error("db_insert_failed");

  return { storyId: String(inserted.id), locale, content, cached: false };
}

function buildTranslateSystemPrompt(target: Locale): string {
  const zh = target === "zh";
  return zh
    ? [
        "你是专业翻译与本地化助手。",
        "把输入文本翻译成中文，并进行轻微本地化润色，但不要改写核心情节与镜头语义。",
        "要求：",
        "- 保持段落结构自然；不要添加标题；不要列表；不要 markdown。",
        "- 语言温柔、具象、有画面感。",
      ].join("\n")
    : [
        "You are a professional translator and localizer.",
        "Translate the input into English with light localization, without changing the core storyline or scene semantics.",
        "Requirements:",
        "- Keep natural paragraphs; no title; no bullets; no markdown.",
        "- Gentle tone, vivid imagery.",
      ].join("\n");
}

function splitForSubtitles(locale: Locale, text: string): string[] {
  const t = text
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  if (!t) return [];

  // 先按段落/句号切大块
  const rough = t
    .split(/\n+/g)
    .flatMap((p) =>
      p
        .split(locale === "zh" ? /[。！？]+/g : /[.!?]+/g)
        .map((s) => s.trim())
        .filter(Boolean),
    );

  // 再把过长的句子按逗号/顿号切分
  const finer = rough.flatMap((s) => {
    const parts = s
      .split(locale === "zh" ? /[，、；;]+/g : /[,;]+/g)
      .map((x) => x.trim())
      .filter(Boolean);
    return parts.length ? parts : [s];
  });

  // 合并成适合字幕的行（控制长度）
  const maxLen = locale === "zh" ? 18 : 42;
  const out: string[] = [];
  let buf = "";
  for (const chunk of finer) {
    if (!buf) {
      buf = chunk;
      continue;
    }
    const next = `${buf}${locale === "zh" ? "，" : ", "}${chunk}`;
    if (next.length <= maxLen) {
      buf = next;
    } else {
      out.push(buf);
      buf = chunk;
    }
  }
  if (buf) out.push(buf);
  return out.slice(0, 60);
}

function toSrt(lines: string[], totalMsOverride?: number): string {
  // 简化：按行数平均分配时长，保证有节奏但不追求精准对齐（阶段二可再升级为按语速估算）
  const n = Math.max(1, lines.length);
  const totalMs =
    typeof totalMsOverride === "number" && Number.isFinite(totalMsOverride) && totalMsOverride > 1000
      ? Math.floor(totalMsOverride)
      : Math.min(75_000, Math.max(18_000, n * 2_600));
  const per = Math.floor(totalMs / n);

  const fmt = (ms: number) => {
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    const ms2 = ms % 1000;
    const pad = (x: number, w: number) => String(x).padStart(w, "0");
    return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms2, 3)}`;
  };

  const blocks: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const start = i * per;
    const end = i === lines.length - 1 ? totalMs : (i + 1) * per;
    blocks.push(String(i + 1));
    blocks.push(`${fmt(start)} --> ${fmt(end)}`);
    blocks.push(lines[i] ?? "");
    blocks.push("");
  }
  return blocks.join("\n");
}

async function uploadPublicObject(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  bucket: string;
  path: string;
  bytes: Uint8Array;
  contentType: string;
}): Promise<string> {
  const { error } = await params.supabase.storage
    .from(params.bucket)
    .upload(params.path, params.bytes, { contentType: params.contentType, upsert: true });
  if (error) throw new Error("storage_upload_failed");

  const { data } = params.supabase.storage.from(params.bucket).getPublicUrl(params.path);
  const url = String(data?.publicUrl ?? "").trim();
  if (!url) throw new Error("storage_public_url_missing");
  return url;
}

export async function generateLocalizedStoryMedia(input: {
  storyId: string;
  newLocale: Locale;
  /** true 时即使已有文本也会生成音频/字幕 */
  ensureAudioSubtitle?: boolean;
}): Promise<{
  storyId: string;
  locale: Locale;
  content: string;
  audioUrl: string | null;
  subtitleUrl: string | null;
  mediaError: string | null;
  cached: boolean;
}> {
  const cfg = getOpenAIDreamConfig();
  if (!cfg) throw new Error("dream_openai_not_configured");

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");

  const storyId = String(input.storyId ?? "").trim();
  if (!storyId) throw new Error("missing_story_id");
  const locale = input.newLocale === "zh" ? "zh" : ("en" as Locale);

  const { data: mediaCached } = await supabase
    .from("goal_media")
    .select("content,locale,audio_url,subtitle_url")
    .eq("story_id", storyId)
    .eq("locale", locale)
    .maybeSingle();
  const wantMedia = Boolean(input.ensureAudioSubtitle);
  if (mediaCached?.content && (!wantMedia || (mediaCached.audio_url && mediaCached.subtitle_url))) {
    return {
      storyId,
      locale,
      content: String(mediaCached.content),
      audioUrl: mediaCached.audio_url ? String(mediaCached.audio_url) : null,
      subtitleUrl: mediaCached.subtitle_url ? String(mediaCached.subtitle_url) : null,
      mediaError: null,
      cached: true,
    };
  }

  const { data: story, error: storyError } = await supabase
    .from("goal_stories")
    .select("id,goal_id,content,locale")
    .eq("id", storyId)
    .maybeSingle();
  if (storyError || !story?.id) throw new Error("story_not_found");

  const { data: goal, error: goalError } = await supabase
    .from("financial_goals")
    .select("id,user_id")
    .eq("id", story.goal_id)
    .maybeSingle();
  if (goalError || !goal?.id) throw new Error("goal_not_found");
  if (String(goal.user_id) !== auth.user.id) throw new Error("forbidden");

  const sourceText = String(story.content ?? "").trim();
  if (!sourceText) throw new Error("story_empty");

  const client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL, timeout: 90_000 });

  const content = (() => {
    const existing = mediaCached?.content ? String(mediaCached.content).trim() : "";
    return existing;
  })();

  const localizedText = content
    ? content
    : (() => {
        // 翻译/本地化（仅当未缓存文本时）
        return "";
      })();

  const finalText = localizedText
    ? localizedText
    : (() => {
        // 生成新文本（翻译）
        return null;
      })();

  let newContent = finalText;
  if (!newContent) {
    const completion = await client.chat.completions.create({
      model: cfg.translateModel,
      messages: [
        { role: "system", content: buildTranslateSystemPrompt(locale) },
        { role: "user", content: sourceText },
      ],
      max_tokens: locale === "zh" ? 800 : 700,
    });

    newContent = String(completion.choices[0]?.message?.content ?? "").trim();
    if (!newContent) throw new Error("empty_completion");
  }

  const existingAudio = mediaCached?.audio_url ? String(mediaCached.audio_url) : null;
  const existingSubtitle = mediaCached?.subtitle_url ? String(mediaCached.subtitle_url) : null;

  let audioUrl: string | null = existingAudio;
  let subtitleUrl: string | null = existingSubtitle;
  let mediaError: string | null = null;

  if (wantMedia && (!audioUrl || !subtitleUrl)) {
    const { data: goalRow } = await supabase
      .from("financial_goals")
      .select("user_id")
      .eq("id", story.goal_id)
      .maybeSingle();
    const userId = String(goalRow?.user_id ?? "").trim();
    if (!userId) throw new Error("user_id_missing");

    const basePath = `${userId}/goals/${String(story.goal_id)}/stories/${storyId}/${locale}`;
    try {
      // TTS
      const speech = await client.audio.speech.create({
        model: cfg.ttsModel,
        voice: cfg.ttsVoice,
        input: newContent,
        response_format: "mp3",
      });
      const audioBytes = new Uint8Array(await speech.arrayBuffer());

      audioUrl = await uploadPublicObject({
        supabase,
        bucket: GOAL_MEDIA_BUCKET,
        path: `${basePath}/narration.mp3`,
        bytes: audioBytes,
        contentType: "audio/mpeg",
      });

      // Subtitles (SRT)
      const srtLines = splitForSubtitles(locale, newContent);
      const srt = toSrt(srtLines);
      const srtBytes = new TextEncoder().encode(srt);
      subtitleUrl = await uploadPublicObject({
        supabase,
        bucket: GOAL_MEDIA_BUCKET,
        path: `${basePath}/subtitles.srt`,
        bytes: srtBytes,
        contentType: "application/x-subrip",
      });
    } catch (e) {
      // 降级：只保留文本，不让整条流程失败
      const msg = e instanceof Error ? e.message : "unknown";
      mediaError = `media_generation_failed: ${msg}`;
      audioUrl = existingAudio ?? null;
      subtitleUrl = existingSubtitle ?? null;
    }
  }

  const { error: upsertError } = await supabase.from("goal_media").upsert(
    {
      story_id: storyId,
      locale,
      content: newContent,
      audio_url: audioUrl,
      subtitle_url: subtitleUrl,
    },
    { onConflict: "story_id,locale" },
  );
  if (upsertError) throw new Error("db_upsert_failed");

  return {
    storyId,
    locale,
    content: newContent,
    audioUrl,
    subtitleUrl,
    mediaError,
    cached: Boolean(mediaCached?.content),
  };
}

async function dmxPostImages(params: {
  baseURL: string;
  apiKey: string;
  payload: unknown;
}): Promise<unknown> {
  const url = `${params.baseURL.replace(/\/$/, "")}/images/generations`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: params.apiKey.startsWith("Bearer ") ? params.apiKey : params.apiKey,
  };
  const tryOnce = async (payload: unknown): Promise<{ ok: boolean; status: number; text: string; parsed: unknown | null }> => {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload), cache: "no-store" });
    const text = await res.text();
    let parsed: unknown | null = null;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = null;
    }
    return { ok: res.ok, status: res.status, text, parsed };
  };

  const first = await tryOnce(params.payload);
  if (first.ok) return first.parsed;

  const msg1 =
    first.parsed && typeof first.parsed === "object" && "error" in (first.parsed as Record<string, unknown>)
      ? JSON.stringify((first.parsed as Record<string, unknown>).error)
      : first.text.slice(0, 800);

  // 部分网关不支持 response_format：如果报 unknown_parameter，则自动去掉再试一次
  const payloadObj = params.payload && typeof params.payload === "object" ? (params.payload as Record<string, unknown>) : null;
  const hasResponseFormat = Boolean(payloadObj && "response_format" in payloadObj);
  const looksUnknownParam = /unknown_parameter/i.test(msg1);
  if (hasResponseFormat && looksUnknownParam && payloadObj) {
    const { response_format, ...rest } = payloadObj;
    void response_format;
    const second = await tryOnce(rest);
    if (second.ok) return second.parsed;
    const msg2 =
      second.parsed && typeof second.parsed === "object" && "error" in (second.parsed as Record<string, unknown>)
        ? JSON.stringify((second.parsed as Record<string, unknown>).error)
        : second.text.slice(0, 800);
    throw new Error(`dmx_http_${second.status}:${msg2}`);
  }

  throw new Error(`dmx_http_${first.status}:${msg1}`);
}

function extractImageB64OrUrl(json: unknown): { b64: string | null; url: string | null } {
  const root = json && typeof json === "object" ? (json as Record<string, unknown>) : null;
  const data = root && Array.isArray(root.data) ? (root.data as unknown[]) : [];
  const first = data.length && typeof data[0] === "object" ? (data[0] as Record<string, unknown>) : null;
  const b64 = first && typeof first.b64_json === "string" ? first.b64_json : null;
  const url = first && typeof first.url === "string" ? first.url : null;
  return { b64, url };
}

/** 将文生图结果写入 Storage；网关若只返回 URL 则先拉取再上传（DMX 国际站常不支持 response_format） */
async function persistDreamShotFromGeneration(params: {
  json: unknown;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  bucketPathPrefix: string;
  shotIdx: number;
}): Promise<string> {
  const one = extractImageB64OrUrl(params.json);
  if (one.url) {
    let res: Response;
    try {
      res = await fetch(one.url.trim(), { cache: "no-store" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`dream_image_url_fetch_failed:${msg}`);
    }
    if (!res.ok) throw new Error(`dream_image_url_fetch_failed:http_${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const ct = res.headers.get("content-type") ?? "";
    const ext = ct.includes("jpeg") || ct.includes("jpg") ? "jpeg" : "png";
    const mime = ext === "jpeg" ? "image/jpeg" : "image/png";
    return uploadPublicObject({
      supabase: params.supabase,
      bucket: GOAL_MEDIA_BUCKET,
      path: `${params.bucketPathPrefix}/shot-${params.shotIdx + 1}-pb${DREAM_VISUAL_PROMPT_BUILD_ID}.${ext}`,
      bytes,
      contentType: mime,
    });
  }
  if (!one.b64) throw new Error("image_generation_failed");
  const bytes = Uint8Array.from(Buffer.from(one.b64, "base64"));
  return uploadPublicObject({
    supabase: params.supabase,
    bucket: GOAL_MEDIA_BUCKET,
    path: `${params.bucketPathPrefix}/shot-${params.shotIdx + 1}-pb${DREAM_VISUAL_PROMPT_BUILD_ID}.png`,
    bytes,
    contentType: "image/png",
  });
}

function addShotVariation(basePrompt: string, idx: number): string {
  const t = basePrompt.trim();
  const variations = [
    "wide shot, bright morning, crisp neutral color grading",
    "wide shot, golden hour sunset, warm cinematic color grading",
    "medium shot, rainy overcast afternoon, cool muted color grading",
    "wide shot, blue hour evening, deep teal-and-amber cinematic grade",
    "medium shot, night interior, soft tungsten warmth with gentle contrast",
    "wide shot, sunny midday, high-key clean whites, modern premium look",
    "medium shot, moody cloudy day, soft shadows, filmic desaturated tones",
    "wide shot, sunrise haze, pastel highlights, airy luxury editorial look",
    "medium shot, winter clear light, cool clean highlights, premium minimal palette",
  ];
  const tail = variations[idx % variations.length] ?? variations[0]!;
  return `${t}, ${tail}, ${stylePackForShot(idx, null)}`;
}

type StylePackId =
  | "jp_clean"
  | "fr_film"
  | "nordic_natural"
  | "cinematic_teal_amber"
  | "pastoral_poetic"
  | "ad_arch_digest"
  | "clean_modern_minimal";

function stylePackForShot(idx: number, seed?: string | null): string {
  // 平台默认：8 种风格包轮换；同一组只有 6 张时，用 seed 偏移让每次生成覆盖不同子集
  const packs: Array<{ id: StylePackId; text: string }> = [
    {
      id: "fr_film",
      text: "French vintage editorial, Portra 400 film look, soft halation, warm highlights, gentle contrast, subtle grain, timeless and tasteful",
    },
    {
      id: "jp_clean",
      text: "Japanese clean lifestyle photography, airy, clean whites, calm composition, soft daylight, gentle depth of field, minimal decor",
    },
    {
      id: "nordic_natural",
      text: "Nordic natural materials, oak stone plaster, muted tones, soft overcast light, cozy but refined, architectural digest vibe",
    },
    {
      id: "cinematic_teal_amber",
      text: "cinematic teal-and-amber color grade, controlled highlights, gentle bloom, realistic, premium film still",
    },
    {
      id: "clean_modern_minimal",
      text: "quiet luxury, modern minimal composition, refined neutral palette, clean lines, natural light, museum-quality finish, subtle grain",
    },
    {
      id: "pastoral_poetic",
      text: "pastoral poetic, rustic picturesque, morning mist, golden backlight, natural textures, calm countryside mood, 35mm film look, subtle grain",
    },
    {
      id: "ad_arch_digest",
      text: "architectural digest style, magazine-quality architectural photography (no text), balanced composition, premium materials, controlled highlights, photoreal",
    },
  ];
  const offset = (() => {
    const s = String(seed ?? "").trim();
    if (!s) return 0;
    const h = Number.parseInt(s.slice(0, 2), 16);
    return Number.isFinite(h) ? h : 0;
  })();
  const pick = packs[(idx + offset) % packs.length] ?? packs[0]!;
  // 额外抖动（小概率）避免长时间轮换仍显得“公式化”
  const jitter = diversityStyleJitter();
  return `${pick.text}, ${jitter}`.trim();
}

function hasStylePackCue(prompt: string): boolean {
  const s = String(prompt ?? "").toLowerCase();
  return (
    s.includes("portra 400") ||
    s.includes("japanese clean lifestyle") ||
    s.includes("nordic natural materials") ||
    s.includes("teal-and-amber") ||
    s.includes("pastoral poetic") ||
    s.includes("architectural digest") ||
    s.includes("quiet luxury, modern minimal")
  );
}

function applyStylePackRotation(prompts: string[], seed: string | null | undefined): string[] {
  return prompts.map((p, i) => {
    if (!p) return p;
    if (hasStylePackCue(p)) return p;
    return `${p}, ${stylePackForShot(i, seed)}`.trim();
  });
}

function buildShotPromptsSystem(n: number): string {
  return [
    "You are a creative director for short lifestyle visuals.",
    `Given a base concept prompt, generate ${n} distinct English prompts for ${n} shots of the same story.`,
    "Hard requirements:",
    `- Output MUST be valid JSON ONLY: {"prompts":[...]} (array length ${n})`,
    `- Exactly ${n} prompts, each 16–42 words.`,
    "- Prompts must be clearly different across shots (different location, action, and composition).",
    "- Camera/framing: ONLY wide shot or medium shot. NO close-up, NO macro, NO detail-only shots.",
    "- Scene goal: beautiful, refined, cinematic establishing frames (like premium lifestyle ads).",
    "- Aesthetic bar (critical): aim for TOP-TIER motion-picture and AWARD-WINNING editorial photography — rich controlled contrast, purposeful color science, dimensional light, depth and atmosphere like a major film color grade or World Press / National Geographic / Architectural Digest annual winners — NOT flat stock-photo filler, NOT generic AI gloss.",
    "- Style axis A (architecture/interior): if you use interiors, mix American style and European style across the set.",
    "- Style axis B (mood): for each shot choose either (1) luxurious & exquisite OR (2) rustic & picturesque OR (3) fresh pastoral & natural.",
    "- Style axis C (lifestyle vibe): premium, tasteful, warm, calm. Do NOT force every shot into luxury real-estate; match the story (travel / garden / countryside / city).",
    "- Ensure the set is not monotonous: alternate styles and moods with a clear rhythm.",
    "- People: allowed when the story requires them (e.g., family at a dining table). Avoid close-up portrait framing.",
    "- Al fresco dining (exterior only): if dining appears, use outdoor terrace or garden patio with table—never enclosed dining room inside a house.",
    "- Beauty/finish: flattering soft lighting, healthy glow, polished but natural look, clean cinematic color grading, 35mm photo look.",
    "- Avoid: harsh shadows, gritty skin, uncanny faces, exaggerated wrinkles, distorted anatomy.",
    "- Color diversity: each shot MUST specify a distinct time-of-day + lighting + color grading (e.g., morning neutral, golden hour warm, overcast cool, blue-hour teal/amber, night tungsten). Do NOT repeat the same palette across shots.",
    "- Housing mention rule: if the story or goal implies buying a home / moving / mortgage / '安家' / '买房', include EXACTLY ONE real-estate establishing shot of a home property (prefer EXTERIOR). Make it premium like a modern villa / courtyard / infinity pool / mountain or city view, golden hour, architectural photography, wide shot. Only ONE shot may feel like a luxury home listing; all other shots should emphasize lifestyle (travel, garden, countryside, daily breakfast).",
    "- EXTERIOR-FIRST POLICY (critical): Every shot MUST be outdoor open-air OR clear exterior architecture—gardens courtyards terraces pool decks beaches mountain trails parks countryside lanes villa EXTERIORS airport seen from outside or terminal only if travel shot. ZERO domestic interior rooms: no bedroom, no living room, no enclosed dining room, no indoor kitchen, no furnished study, no sunroom with desk—users dislike cluttered indoor floors; use garden patio al fresco outdoor kitchen instead.",
    "- Diversity requirement (all exterior, no repeats): front porch steps / entryway exterior, countryside field path, airport exterior or runway verge, outdoor terrace dining, outdoor summer kitchen patio, garden terrace, neighborhood park path, outdoor botanical garden walkways (blooms), ornamental horticulture scenes below, GREAT RIVER GORGE or wide river valley hiking trail flanked by AZALEA and RHODODENDRON slopes in peak bloom (no humans), and CHINA-style NATIONAL FOREST PARK primeval woodland with ANCIENT TOWERING TREES boardwalk or stone trail under cathedral canopy.",
    "- Ornamental horticulture & vistas (strong positive—use for landscape/garden shots): mass plantings of roses, rhododendrons, azaleas, alpine wildflower meadows, layered perennial borders with refined photoreal color harmony, heritage botanical garden walkways, signature national-park or UNESCO-tier scenic vista—world-class tourism brochure beauty, immaculate beds and paths.",
    "- Iconic China-travel nature (use sparingly, wide establishing): misty GREAT RIVER or blue-green torrent visible beside trail; AZALEA SEA and rhododendron-covered slopes along a hiking path above the water—magazine-grade trekking vista EMPTY of people; separate shot type: designated NATIONAL FOREST PARK mood—millennium-old trees, gnarled trunks, mossy boulders, mist between colossal canopies, wooden boardwalk or granite stepping path—still NO humans.",
    "- Blooms mandate (critical): show abundant OPEN FLOWERS with visible petals and COLOR where appropriate—not foliage-only green interiors; on EXTERIOR terraces patios balconies courtyards pool decks and raised planters, NEVER output herb-only or lettuce-only boxes—include roses geraniums petunias bougainvillea wisteria blooms or mixed ornamental color.",
    "- Indoor flower placement (critical): In enclosed rooms (bedroom, living room, dining, interior sunroom, salon), flowers MUST appear in vases, urns, wall-mounted planters, etagères, plant stands, consoles, mantels, or tabletops—NOT as a carpet of blooms sprouting from the interior floor, NOT a lone vase sitting on bare floor boards or tile. Outdoor scenes EXEMPT: meadows, hillsides, garden borders, exterior terraces and paths may have ground-level flower masses.",
    "- Blooms in glasshouse/conservatory: prefer staged blooms on benches trestles shelving and hanging baskets—avoid indoor soil carpet full of flowers like a field indoors.",
    "- Anti-allotment-indoors (critical): NEVER place vegetable crates, salad beds, lettuce boxes, or messy twig piles inside bedrooms, on tile floors beside beds, or in living-room interiors—no bedroom-meets-allotment mashup; food-growing plots belong ONLY in clearly OUTDOOR kitchen gardens if used at all, tidy and separate from sleeping spaces.",
    "- Diversity mandate (critical): NEVER output near-duplicate prompts across the set. Change at least TWO of: dominant setting type, focal furniture, architectural era (mid-century/contemporary/industrial/neoclassical/coastal farmhouse), dominant materials (wood/stone/plaster/concrete/brass/glass).",
    "- Anti-homogenization (critical): vary outdoor location types—do NOT repeat the same villa pool deck or same garden path; rotate coast mountain park terrace orchard runway exterior river-gorge azalea trail primeval national-forest overlook.",
    "- Strong anti-template rule: avoid repeating generic layouts like 'same gray sofa centered under same large window white walls' across prompts—vary window/door proportions, ceiling height cues, floor materials, and camera angle intent.",
    "- Each run must feel like different properties on different days (weather/time cues must differ).",
    "- Avoid bland/abstract frames: no empty fabric/curtain-only shots, no drapes-only, no texture-only, no minimal blank wall.",
    "- Avoid city skyline: no downtown skyscraper skyline, no CBD towers, no generic cityscape establishing shot. Also avoid corporate downtown promo look: no empty CBD street canyon between mirrored glass skyscrapers, no symmetrical vanishing-point boulevard, no reflective marble plaza with towers. Prefer human-scale OUTDOOR places: garden, porch, countryside path, runway exterior, outdoor dining patio, river-valley hiking trail with floral slopes, old-growth national forest park.",
    "- Travel / airport visuals (critical): prefer EXTERIOR runway taxiway apron perimeter fence control tower wide shot—open sky and tarmac. Do NOT describe terminal interior as a living room with sofas beanbags rugs planting troughs along glass or cozy corners; that layout triggers junk props (firewood bins Mickey dolls). For flight stories use OUTDOOR aviation establishing shots only unless explicitly requesting empty gate hall without residential furniture.",
    "- Style packs (rotate, no repeats back-to-back): (A) Japanese clean lifestyle (airy, clean whites), (B) French vintage film (Portra 400, soft halation), (C) Nordic natural materials (oak/stone/plaster, muted), (D) Cinematic teal-and-amber grade, (E) quiet luxury modern minimal, (F) pastoral poetic, (G) architectural digest style. Apply a different pack to each shot.",
    "- If the story mentions carpet/rug/bedding/curtains, show the FULL room or scene — never a macro of the textile filling the frame.",
    "- No text, no letters, no watermark, no logos, no brands.",
    "- No quotes, no markdown.",
    "- Negative constraints: no portrait, no face close-up, no close-up, no macro, no hands, no extra fingers, no deformed anatomy, no creepy skin.",
    "- Also avoid weird/unclear subjects: no covered objects, no blanket-covered mound, no mysterious package, no trash pile, no random blob, no surreal installation, no creepy dolls, no horror vibe.",
    "- Refuse & bins (critical): NO garbage cans, NO trash bins, NO wheelie bins, NO recycling bins, NO dumpsters, NO municipal waste barrels, NO black plastic refuse drums beside walls — gardens must stay picturesque; if compost is needed describe wooden compost bays or woven enclosures only, never bin-shaped plastic tubs.",
    "- Floor clutter (critical): no heap of blankets pillows or duvets on the floor, no beanbag, no dog bed, no rumpled fabric pile by the window or rocking chair, no lumpy brown mound, no cushion stack on the ground — keep floor clean and readable.",
    "- Ground hygiene (critical): no scattered leaves, twigs, or loose foliage clippings on indoor floors, tile, polished concrete, kitchen slabs, or porch/patio paving; no random green herb sprigs or leaf piles as messy debris; outdoor paths may be tidy gravel or lawn edges only—no litter-like leaf scatter on light flooring.",
    "- Dead wood ban (critical): NO piles of dry branches, firewood stacks, driftwood heaps, or leafless twig bundles on patio stone pool deck rug or tile—especially ugly brown stick piles; explicitly forbid STACKED SPLIT LOGS, CORDWOOD, KINDLING HEAPS, LOG RACKS, or timber piles in corners beside outdoor dining or breakfast terraces—those read as messy firewood not décor; outdoor floors must look curated and clean.",
    "- Indoor vs cultivation (critical): bedrooms and sleeping areas must stay horticulture-free except cut flowers in a vase; never wooden veg planters or irrigation on bedroom floor.",
    "- Bedding taste (critical): luxury adult bedding only—solid muted linen, subtle weave, or refined hotel-style neutrals; NO cartoon prints, NO Mickey Mouse or Disney-style character sheets, NO licensed mascot patterns on duvet—would clash with cinematic upscale interiors.",
    "- Planters indoors (critical): NO raised wooden planting boxes, NO soil-filled vegetable troughs or lettuce crates standing on living-room or bedroom tile—those belong ONLY in clearly OUTDOOR garden shots; never stack airport runway vista + indoor allotment in one absurd frame.",
    "- Black metal or plastic INDOOR PLANTING TROUGHS (critical): NO long rectangular black planter boxes, NO indoor salad or herb beds on tile beside a bed or sofa, NO grow-trough with soil in a residential room—if you need plants indoors use a small POTTED ORNAMENT on a stand or a VASE of cut flowers, never a field bed by the window.",
    "- Reading props on ground (critical): NO books, magazines, newspapers, journals, or papers lying on the floor, grass, tile, or paving — no open book as decoration; reading material belongs on shelves or tables only if needed, never underfoot.",
    "- Focus subjects (rotate, exterior only): porch steps morning light; rose or rhododendron mass bloom beside manicured garden path; wildflower hillside vista; refined flower borders and reflective pool OUTDOORS; heritage botanical garden exterior walkways; outdoor terrace dining table with flowers; outdoor patio breakfast setup; airport runway exterior travel mood; serene countryside path; garden terrace; neighborhood park path; misty mountain scenic overlook; villa pool courtyard at sunset; GREAT RIVER or wide gorge hiking trail with AZALEA and RHODODENDRON sea on banks and cliffs (empty trail no hikers); CHINA NATIONAL FOREST PARK primeval forest ANCIENT TOWERING TREES misty canopy boardwalk or stone path—all open sky or unambiguous exterior.",
  ].join("\n");
}

function parseShotPrompts(jsonText: string, n: number): string[] {
  try {
    const obj = JSON.parse(jsonText) as unknown;
    if (!obj || typeof obj !== "object") return [];
    const prompts = (obj as { prompts?: unknown }).prompts;
    if (!Array.isArray(prompts)) return [];
    const out = prompts.map((p) => String(p ?? "").trim()).filter(Boolean);
    if (out.length !== n) return [];
    return out;
  } catch {
    return [];
  }
}

function enforceWideMediumOnly(prompt: string): string {
  const p = String(prompt ?? "").trim();
  if (!p) return "";
  // 把容易引导人像特写的词硬替换掉
  const replaced = p
    .replace(/\b(close[-\s]?up|macro|portrait|headshot|beauty shot)\b/gi, "medium shot")
    .replace(/\b(face close[-\s]?up|close[-\s]?up face)\b/gi, "medium shot")
    .replace(/\b(extreme close[-\s]?up)\b/gi, "medium shot")
    .replace(/\bselfie\b/gi, "medium shot")
    .replace(/\b(smiling at camera|look(?:ing)? at the camera|direct eye contact)\b/gi, "candid moment, not looking at camera");

  const allowPeople =
    (/\bfamily\b/i.test(p) && /\b(dining|dinner|meal|eating)\b/i.test(p)) ||
    ((/\bfive people\b/i.test(p) || /\bthree people\b/i.test(p)) && /\bfrom behind\b/i.test(p));
  const isAzaleaBackwalk =
    /\bazalea\b/i.test(p) && /\brhododendron\b/i.test(p) && /\bfrom behind\b/i.test(p);
  const allowAirplanes = /\b(airport|runway|tarmac|airfield|aviation)\b/i.test(p);

  // 追加硬约束（重复强调更有效）
  const hardTailParts = [
    "ONE clear setting only (single location), do NOT merge multiple places in one frame",
    "wide shot or medium shot only",
    "shot from across the room, full environment visible",
    ...(allowPeople
      ? [
          "no faces visible, no front view, no portrait",
          ...(isAzaleaBackwalk
            ? [
                "clothing must be bright light-colored pastel only (no black clothing, no charcoal, no dark gray, no navy, no dark outfits, no black-and-white outfits, not silhouette)",
              ]
            : []),
        ]
      : [
          "absolutely no people, no humans, no faces, no silhouettes, no human shadows, no body parts",
        ]),
    "no cartoon, no illustration, no character, no mascot, no anime, no stylized 3d figure",
    "no oil painting, no painted look, no brush strokes, no watercolor painting",
    "avoid black and gray murky lighting, avoid gloomy dark desaturated mood; prefer bright warm cozy lighting and cheerful color grading",
    "no close-up, no portrait, no face close-up, no macro, no selfie",
    "no indoor-outdoor mashup, no window-view montage, no looking from inside to another location outside",
    "no covered objects, no blanket-covered mound, no mysterious package, no random blob",
    "no floor heap of blankets pillows or duvets, no beanbag, no fabric pile by window or chair, no lumpy textile mound",
    "no scattered leaves twigs or loose foliage on floor, no random green clumps or leaf litter on tile stone concrete or indoor paving, no messy herb debris on ground",
    "no loose tree branches, no fallen branches, no sticks lying on the ground, no twig pile, no twig bundles, no leafless twigs",
    "no deadwood, no driftwood, no cordwood, no kindling heaps, no firewood bundles, no dry sticks pile",
    "no book magazine newspaper journal or papers on floor or ground, no open book underfoot, no reading material on tile grass or paving",
    "no vegetable planters or lettuce beds inside bedroom or on tile next to bed, no indoor allotment beside sleeping area, no messy twig pile on interior floor",
    "no raised wooden planter boxes or soil crop troughs on indoor tile or hardwood, no interior room filled with allotment beds",
    "no black rectangular metal plastic planting trough or salad/herb bed on tile floor beside bed or sofa, no indoor soil crate next to runway window",
    "no cartoon character bedding, no Mickey Mouse print sheets, no Disney-style mascot duvet, adult refined neutral luxury linens only",
    "for conservatory garden greenhouse flower-border terrace patio balcony courtyard or raised planter scenes require abundant visible blooming flowers with petals not foliage-only green succulents ferns or herb boxes alone",
    "for interior rooms flowers in vases or on plant stands shelving only, no flower sea carpeting indoor tile floor, no vase on bare floor",
    "no dead branch pile firewood bundle cordwood stack split logs timber pile kindling heap log rack dry twig heap on patio pool deck terrace balcony rug or stone tile, no messy driftwood stack, no stacked firewood in corners near dining table, no pruned branches pile",
    ...(allowAirplanes
      ? []
      : [
          "no airplanes, no aircraft, no jets, no planes visible (anywhere)",
        ]),
    "no garbage can trash bin wheelie bin recycling bin dumpster municipal waste barrel black plastic refuse drum beside wall",
    "no Mickey Mouse, no Minnie, no Disney character, no cartoon mouse, no plush toy, no stuffed toy, no doll, no mascot character",
    "no curtain-only, no drapes-only, no fabric-only, no textile swatch, no rug or carpet macro, no yellow cloth abstract fill",
    "Hollywood-grade cinematic wide establishing shot, award-winning editorial still photography, museum-quality color grade and light, not stock-photo flatness",
  ];

  const hardTail = hardTailParts.join(", ");

  // 确保硬约束一定生效：不要因为 prompt 已包含“wide shot or medium shot only”就跳过 hardTail。
  // 仅在硬负面词已经出现时，才避免重复追加。
  const alreadyHasHardNegatives =
    /no dead branch pile|no scattered leaves twigs|no Mickey Mouse|no oil painting|no airplanes|no loose tree branches/i.test(replaced);

  return alreadyHasHardNegatives ? replaced : `${replaced}, ${hardTail}`;
}

function normalizeShotPrompts(prompts: string[], n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < Math.min(n, prompts.length); i++) {
    const fixed = enforceWideMediumOnly(prompts[i] ?? "");
    if (fixed) out.push(fixed);
  }
  return out;
}

type ShotBucket =
  | "housing_listing"
  | "porch_entry"
  | "vegetable_garden"
  | "flower_greenhouse"
  | "country_path"
  | "airport_travel"
  | "travel_azalea_stream_backwalk"
  | "kitchen"
  | "dining"
  | "garden_terrace"
  | "neighborhood_park"
  | "other";

function hasHousingSignal(text: string): boolean {
  const s = String(text ?? "");
  return /housing|house|home|mortgage|房贷|置业|新居|首付|楼盘|户型|安家|买房|看房|月供|全屋/.test(s);
}

function hasTravelSignal(text: string): boolean {
  const s = String(text ?? "");
  return /travel|trip|airport|flight|plane|jet|train|station|旅行|旅游|机场|航班|机票|登机|飞去|高铁|车站|南美|冰岛|极光|樱花/.test(s);
}

function cleanBaseConceptForTemplates(baseConcept: string): string {
  // basePrompt 往往包含多个地点线索（旅行+家+花园），直接拼到每张模板里会导致“混搭场景”
  // 这里只保留“氛围/质感”相关词，去掉常见地点/交通关键词
  return String(baseConcept ?? "")
    .replace(/\b(airport|terminal|runway|gate|boarding|airplane|plane|jet|flight|train|station|subway|downtown|skyline|skyscraper)\b/gi, "")
    .replace(/\b(kitchen|dining|living room|bedroom|bathroom|office|lobby)\b/gi, "")
    .replace(/\b(garden|vegetable|greenhouse|farm|field|countryside|rural|meadow|orchard)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

/** 厨房室内镜头：去掉易诱发「窗边种植槽/室内菜圃」的 vibe 片段（养花种菜、garden and plants 等） */
function cleanVibeForKitchenIndoor(vibe: string): string {
  return String(vibe ?? "")
    .replace(/\b(plants?|planting|herbs?|herb|seedlings?|seedling|planters?|planter|grow lights?|indoor garden|windowsill garden|microgreens?)\b/gi, "")
    .replace(/养花种菜|养花|种菜|园艺|盆栽|芽苗|香草|种植/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

function templatePrompt(bucket: ShotBucket, baseConcept: string, styleSeed?: string | null, styleIndex?: number): string {
  // 保持“无人物 + wide/medium + 生活方式”一致；尽量复用 baseConcept 的主题词但不要复刻同一房间
  const vibe = cleanBaseConceptForTemplates(baseConcept);
  const style = stylePackForShot(typeof styleIndex === "number" ? styleIndex : Math.abs(bucket.length), styleSeed);
  const emptyExposure = "long exposure, empty scene, absolutely no people, no silhouettes, no human shadows";
  const v = typeof styleIndex === "number" ? Math.abs(styleIndex) : Math.abs(bucket.length);
  const variant = v % 3;
  // 解决“摇椅+茶壶+书”自动复用导致的雷同：默认不主动提这些道具，并显式允许不同替代道具
  const antiRepeatingProps =
    "avoid repeating the same props across shots (no constant rocking chair, no constant teapot); never place books magazines or papers on the floor";
  switch (bucket) {
    case "housing_listing":
      return `architectural photography, modern villa exterior with courtyard and infinity pool, mountain backdrop, golden hour, wide shot, premium property, ${emptyExposure}, no text, ${style}, ${antiRepeatingProps}${vibe ? `, ${vibe}` : ""}`;
    case "porch_entry":
      return [
        `front porch wooden steps with morning sunlight, entryway exterior, potted plants, cozy welcoming home, wide shot, ${emptyExposure}, no text, ${style}, strictly a home porch only, no airport, no airplane, no terminal, no runway, ${antiRepeatingProps}`,
        `covered front porch with white columns, doormat and lantern sconce, seasonal foliage, wide shot, ${emptyExposure}, no text, ${style}, strictly a home porch only, no airport, no airplane, no terminal, no runway, ${antiRepeatingProps}`,
        `front entry patio with stone pavers, simple bench (not a rocking chair), planters, warm morning light, wide shot, ${emptyExposure}, no text, ${style}, strictly a home porch only, no airport, no airplane, no terminal, no runway, ${antiRepeatingProps}`,
      ][variant] + (vibe ? `, ${vibe}` : "");
    case "vegetable_garden":
      return [
        `raised vegetable garden beds with dew on leaves, neat rows of seedlings, garden tools nearby, fresh morning air, outdoor only, wide shot, ${emptyExposure}, no text, ${style}, strictly garden only, no interior, no kitchen, no stove, no countertop, no dining table, no window view, no house interior, no airport, no airplane, no terminal, no runway, no city skyline, ${antiRepeatingProps}`,
        `ornamental terrace garden with raised planters overflowing with roses geraniums petunias and climbing blooms visible colored petals, trellis with flowers not herbs-only, morning mist, outdoor only, wide shot, ${emptyExposure}, no text, ${style}, strictly ornamental flower garden only no herb-only boxes, no interior, no airport, no runway, ${antiRepeatingProps}`,
        `neat vegetable rows beside a rustic tool shed, rake and watering can on stone path, colorful flower border along the walk, soft overcast light, outdoor only, wide shot, ${emptyExposure}, no text, ${style}, strictly cottage garden only no trash bins or wheelie bins, no interior, no airport, no runway, ${antiRepeatingProps}`,
      ][variant] + (vibe ? `, ${vibe}` : "");
    case "flower_greenhouse":
      return [
        `outdoor botanical garden path between glass pavilion wings mass blooming roses peonies azaleas visible petals, open sky and manicured gravel no enclosed domestic room, wide shot, ${emptyExposure}, no text, ${style}, exterior heritage garden only, no airport, ${antiRepeatingProps}`,
        `open walled flower garden parterre layered blooms reflecting sky climbing roses on stone pergola exterior wide shot, ${emptyExposure}, no text, ${style}, strictly outdoor garden room not indoor studio, no airport, ${antiRepeatingProps}`,
        `sunlit outdoor conservatory facade seen from formal rose terrace fountains flower borders wide establishing shot, ${emptyExposure}, no text, ${style}, exterior viewpoint only no indoor furniture scene, no airport, ${antiRepeatingProps}`,
      ][variant] + (vibe ? `, ${vibe}` : "");
    case "country_path":
      return [
        `quiet countryside path beside fields, trees and open sky, rustic picturesque mood, wide shot, ${emptyExposure}, no text, ${style}, strictly countryside only, no airport, no airplane, no terminal, no runway, ${antiRepeatingProps}`,
        `meadow trail with wildflowers and wooden fence, gentle morning haze, wide shot, ${emptyExposure}, no text, ${style}, strictly countryside only, no airport, no runway, ${antiRepeatingProps}`,
        `gravel country lane with orchard trees and distant hills, soft golden light, wide shot, ${emptyExposure}, no text, ${style}, strictly countryside only, no airport, no runway, ${antiRepeatingProps}`,
        `wide river gorge hiking trail above turquoise water misty cliffs azalea and rhododendron slopes in full bloom pink magenta coral visible petals empty path no people cinematic wide shot, ${emptyExposure}, no text, ${style}, strictly iconic river-valley trek vista only, no airport, no runway, ${antiRepeatingProps}`,
        `China national forest park primeval woodland ancient towering trees moss granite trail wooden boardwalk god rays through canopy mist sacred grove mood empty no people wide shot, ${emptyExposure}, no text, ${style}, strictly old-growth forest park only, no airport, no runway, ${antiRepeatingProps}`,
      ][v % 5] + (vibe ? `, ${vibe}` : "");
    case "airport_travel":
      // 室内航站楼 + 落地窗极易被画成「客厅+窗边种植槽+柴堆」；旅行镜头改为纯外景航空场景，且不拼接 vibe（避免花园词渗入）
      return [
        `photoreal wide EXTERIOR airport perimeter view with runway markings taxiway centerline windsock and clear control tower silhouette, empty tarmac apron, distant airplane visible far away, overcast sky travel mood, ${emptyExposure}, no text, ${style}, strictly outdoor airport grounds only from outside fence line: no indoor window framing no porch roof eaves no living room edges no decorative foreground trees, ${antiRepeatingProps}`,
        `photoreal wide OUTDOOR airport boundary road beside chainlink fence with readable runway geometry and terminal block as midground architecture, empty apron and service lane, distant airplane visible far away, ${emptyExposure}, no text, ${style}, exterior airport context must be obvious and coherent, not inside any building, no indoor gardening no cozy props no cartoon dolls no foreground tree trunks as frame, ${antiRepeatingProps}`,
        `photoreal wide aviation exterior approach with control tower beacon mast runway edge lights and safety fence, empty airfield under rolling clouds, distant airplane taking off in far distance, ${emptyExposure}, no text, ${style}, strictly open-air airport environment only, no terminal hall mixed with home interior no cultivation beds along windows no interior frame-with-view composition, ${antiRepeatingProps}`,
      ][variant];
    case "travel_azalea_stream_backwalk":
      // 这张镜头必须稳定“为一条山顶穿行背影”，但允许在不影响主体的前提下变化细节，避免每次都长得一模一样
      // 选择变体依据：本轮 styleSeed 的前两位 + 镜头索引
      const seedStr = String(styleSeed ?? "").trim();
      const seedH = Number.parseInt(seedStr.slice(0, 2), 16);
      const idxPick = Number.isFinite(seedH) ? (seedH + (typeof styleIndex === "number" ? styleIndex : 0)) % 3 : variant;
      const pastelColors = [
        "clothing colors: cream, pale blue, blush pink",
        "clothing colors: light beige, sage green, dusty rose",
        "clothing colors: light gray, powder blue, soft peach",
      ];
      return [
        `cinematic mountain summit trail on high ground, three people seen from behind only walking along an azalea rhododendron flower hillside path, dense blossoms framing both sides, back view only, no faces visible, no front view, no silhouettes, outdoor open-air scene only, low-angle behind-the-walkers wide shot, natural morning mist, award-winning editorial photography, ${style}, no text, no building, no house, no window frame, no interior furniture, ${pastelColors[0]}, clothing must be bright light-colored pastel only (no black clothing, no charcoal, no dark gray, no navy, no dark outfits, not silhouette), no black-and-white outfits, ${antiRepeatingProps}`,
        `cinematic rocky high-ground footpath on a ridge summit, three people seen from behind only walking through azalea rhododendron flower bushes, narrow trail with scattered stones, back view only, no faces visible, no front view, no silhouettes, outdoor open-air scene only, wide shot, misty air, award-winning editorial photography, ${style}, no text, no building, no house, no window frame, no interior furniture, ${pastelColors[1]}, clothing must be bright light-colored pastel only (no black clothing, no charcoal, no dark gray, no navy, no dark outfits, not silhouette), no black-and-white outfits, ${antiRepeatingProps}`,
        `cinematic summit promenade trail above the treeline (not a valley), three people seen from behind only walking along azalea rhododendron flower banks, blossoms thick in the foreground and midground, back view only, no faces visible, no front view, no silhouettes, outdoor open-air scene only, wide shot, soft sunrise haze, award-winning editorial photography, ${style}, no text, no building, no house, no window frame, no interior furniture, ${pastelColors[2]}, clothing must be bright light-colored pastel only (no black clothing, no charcoal, no dark gray, no navy, no dark outfits, not silhouette), no black-and-white outfits, ${antiRepeatingProps}`,
      ][idxPick];
    case "kitchen": {
      const kv = cleanVibeForKitchenIndoor(vibe);
      const suffix = kv ? `, ${kv}` : "";
      return [
        `outdoor summer kitchen patio stone counters pergola vine citrus trees fruit bowl open sky wide shot, ${emptyExposure}, no text, ${style}, strictly exterior patio kitchen only no indoor walls, no airport, ${antiRepeatingProps}${suffix}`,
        `garden pizza oven terrace outdoor bbq station marble prep island surrounded by flower borders wide shot, ${emptyExposure}, no text, ${style}, strictly outdoor cooking area only, no airport, ${antiRepeatingProps}${suffix}`,
        `covered outdoor kitchen pavilion slate floor flowering planters roses and citrus under pergola visible sky villa courtyard wide shot, ${emptyExposure}, no text, ${style}, open-air pavilion only not enclosed house room, abundant ornamental blooms not herb-only greens, no airport, ${antiRepeatingProps}${suffix}`,
      ][variant];
    }
    case "dining":
      return [
        `elegant weekend dinner at a dining table, family of four seated together eating a meal peacefully, seen from behind only (backs of family visible, no faces visible), candlelight and tasteful flowers, wide shot, bright warm vibrant color grading, ${style}, no text, strictly dining table ceremony only, no airport, ${antiRepeatingProps}`,
        `cozy bright cafe weekend time, family of four seated at a cafe table eating cake and drinking coffee, seen from behind/side angle only (no front view), background bustling cafe crowd with many people blurred in soft bokeh (no distinct faces in focus), wide shot, cheerful vibrant daylight color grading, ${style}, no text, strictly cafe table main scene, no airport, ${antiRepeatingProps}`,
        `sunny cafe brunch table, family of four eating cake and breakfast coffee, three-quarter rear view (no faces visible), background many people blurred, lively cheerful atmosphere, vibrant warm color grading, wide shot, ${style}, no text, no airport, ${antiRepeatingProps}`,
      ][variant] + (vibe ? `, ${vibe}` : "");
    case "garden_terrace":
      return [
        `garden terrace outdoor seating under pergola mass flowering planters roses bougainvillea geraniums visible petals soft golden light wide shot, ${emptyExposure}, no text, ${style}, strictly ornamental terrace only no foliage-only green boxes, no airport, no airplane, no terminal, no runway, ${antiRepeatingProps}`,
        `stone patio bistro set climbing roses and wisteria in bloom terracotta pots colorful petals calm composition wide shot, ${emptyExposure}, no text, ${style}, strictly flowering terrace only not herb garden, no airport, no runway, ${antiRepeatingProps}`,
        `wood deck lounge chair overlooking layered flower borders hydrangeas and peonies in planters morning light wide shot, ${emptyExposure}, no text, ${style}, strictly bloom-filled terrace only no herb-only planters, no airport, ${antiRepeatingProps}`,
      ][variant] + (vibe ? `, ${vibe}` : "");
    case "neighborhood_park":
      return `quiet neighborhood park path with trees and bench, early morning, gentle light, wide shot, ${emptyExposure}, no text, ${style}, strictly park only, no airport, no airplane, no terminal, no runway${vibe ? `, ${vibe}` : ""}`;
    default:
      return `photoreal wide environmental scene, human-scale place, ${emptyExposure}, no text, ${style}${vibe ? `, ${vibe}` : ""}`;
  }
}

function enforceShotSetDiversity(params: {
  prompts: string[];
  n: number;
  baseConcept: string;
  storyText: string;
  styleSeed?: string | null;
}): string[] {
  const wantsAirport = hasTravelSignal(params.storyText);
  const wantsHousing = hasHousingSignal(params.storyText);

  // 非机场镜头：多样化为主，餐桌/家庭只占少量位置
  const cycleNoAirport: ShotBucket[] = [
    "country_path",
    "garden_terrace",
    "neighborhood_park",
    "kitchen",
    "dining",
    "country_path",
    "garden_terrace",
  ];

  // 旅行/机场：第 1 张用 airport_travel，其余仍以多样场景为主，dining 仅少量
  const cycleWithAirport: ShotBucket[] = [
    "country_path",
    "garden_terrace",
    "neighborhood_park",
    "kitchen",
    "garden_terrace",
    "dining",
  ];

  const out: string[] = [];
  for (let i = 0; i < params.n; i++) {
    let bucket: ShotBucket;
    if (wantsAirport && i === 0) bucket = "airport_travel";
    else if (wantsAirport && i === 1) bucket = "travel_azalea_stream_backwalk";
    else if (!wantsAirport && wantsHousing && i === 0) bucket = "housing_listing";
    else {
      const cycle = wantsAirport ? cycleWithAirport : cycleNoAirport;
      // travel 时 i>0：跳过第 1 张 airport_travel，占位 shift = 1
      const shift = wantsAirport && i > 0 ? 1 : 0;
      bucket = cycle[(i - shift + cycle.length) % cycle.length] ?? "country_path";
    }
    out.push(templatePrompt(bucket, params.baseConcept, params.styleSeed, i));
  }

  return normalizeShotPrompts(out, params.n);
}

async function generateShotPrompts(params: {
  basePrompt: string;
  model: string;
  client: OpenAI;
  highQuality: boolean;
  n: number;
  storyText?: string | null;
}): Promise<string[]> {
  const varietyNonce = crypto.randomBytes(8).toString("hex");
  const userContent = [
    `Variety seed: ${varietyNonce}`,
    "Interpret this seed as a creative constraint: explore varied architecture, palette, and composition—do NOT reuse stock interior templates across prompts.",
    "",
    params.basePrompt,
  ].join("\n");
  const completion = await params.client.chat.completions.create({
    model: params.model,
    messages: [
      { role: "system", content: buildShotPromptsSystem(params.n) },
      { role: "user", content: userContent },
    ],
    temperature: 1.35,
    max_tokens: Math.min(1400, 240 + params.n * 70),
  });
  const text = String(completion.choices[0]?.message?.content ?? "").trim();
  const parsed = parseShotPrompts(text, params.n);
  const baseTail =
    " wide shot or medium shot only, no people, no humans, full environment visible, cinematic establishing frame, premium lifestyle ad";
  // 切勿使用 fabric / textile 类词：会稳定生成「一块布」特写（历史 bug）
  const hqTail = params.highQuality
    ? " ultra sharp detail on architecture furniture and windows, cinematic natural lighting, photoreal depth"
    : "";

  if (parsed.length === params.n) {
    const normalized = normalizeShotPrompts(parsed.map((p) => `${p}${hqTail}, ${baseTail}`.trim()), params.n);
    const diversified = enforceShotSetDiversity({
      prompts: normalized,
      n: params.n,
      baseConcept: params.basePrompt,
      storyText: String(params.storyText ?? ""),
      styleSeed: varietyNonce,
    });
    return applyStylePackRotation(diversified, varietyNonce);
  }

  // fallback: 轻变体 + 随机扰动，保证始终可用且彼此更易区分
  const fallback = normalizeShotPrompts(
    Array.from({ length: params.n }, (_, i) => {
      const rot = Number.parseInt(varietyNonce.slice(i % 14, (i % 14) + 2), 16) || i;
      return `${addShotVariation(params.basePrompt, i + rot)}${hqTail}, ${baseTail}`.trim();
    }),
    params.n,
  );
  const diversified = enforceShotSetDiversity({
    prompts: fallback,
    n: params.n,
    baseConcept: params.basePrompt,
    storyText: String(params.storyText ?? ""),
    styleSeed: varietyNonce,
  });
  return applyStylePackRotation(diversified, varietyNonce);
}

function truncateStoryForImagePrompt(text: string, maxChars: number): string {
  const t = String(text ?? "")
    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}…`;
}

/** 文生图专用：必须包含故事正文，否则模型容易根据少数词（如「地毯」）生成布料特写 */
function buildImagePromptUser(params: {
  goalName: string;
  goalType: string;
  keywords: string[];
  freeText?: string | null;
  storyContent?: string | null;
}): string {
  const kw = params.keywords.slice(0, 20).join(", ");
  const extra = String(params.freeText ?? "").trim();
  const story = truncateStoryForImagePrompt(String(params.storyContent ?? "").trim(), 1600);
  const lines = [
    `Financial goal type: ${params.goalType}`,
    `Goal title: ${params.goalName}`,
    kw ? `Keywords: ${kw}` : "",
    extra ? `Notes: ${extra}` : "",
  ].filter(Boolean);
  if (story) {
    lines.push(
      "",
      "Story excerpt — extract 1–3 concrete VISUAL locations from it (rooms, park, garden, airport, street, dining table, facade, neighborhood). Ignore emotional language; describe places and objects.",
      story,
    );
  }
  lines.push(
    "",
    "Reply with ONE English image prompt: a wide or medium shot of a real identifiable place with furniture, architecture, or landscape. The main subject must NOT be fabric, textile, curtains, rug/carpet close-up, bedding texture, or any material surface fill-frame.",
  );
  return lines.join("\n");
}

function buildImagePromptSystem(): string {
  return [
    "You write short English prompts for cinematic text-to-image generation.",
    "Hard requirements:",
    "- Output MUST be a single English prompt string only.",
    "- Max 48 words.",
    "- The scene must show a CLEAR PLACE: interior room, dining area, bedroom, kitchen, park, street, terrace, building exterior, or landscape — with visible walls, windows, furniture, paths, trees, or sky.",
    "- Do NOT write prompts whose subject is fabric, curtains, carpets, rugs, bedding, cushions, cloth, textile, yarn, or any abstract texture or color field.",
    "- No text, no letters, no watermark.",
    "- No logos or brands.",
    "- No quotes, no markdown, no bullet points.",
    "Style: warm, realistic lifestyle photography, natural light, gentle depth of field.",
  ].join("\n");
}

async function generateEnglishImagePrompt(params: {
  goalName: string;
  goalType: string;
  keywords: unknown;
  freeText?: string | null;
  /** 梦想小作文正文；不传则仅用关键词，易出现「一块布」类退化 */
  storyContent?: string | null;
}): Promise<string> {
  const dream = getOpenAIDreamConfig();
  if (!dream) throw new Error("dream_openai_not_configured");
  const client = new OpenAI({ apiKey: dream.apiKey, baseURL: dream.baseURL, timeout: 60_000 });
  const keywords = Array.isArray(params.keywords) ? params.keywords.map((x) => String(x)).filter(Boolean) : [];

  const completion = await client.chat.completions.create({
    model: (process.env.DMX_IMAGE_PROMPT_MODEL ?? dream.translateModel).trim(),
    messages: [
      { role: "system", content: buildImagePromptSystem() },
      {
        role: "user",
        content: buildImagePromptUser({
          goalName: params.goalName,
          goalType: params.goalType,
          keywords,
          freeText: params.freeText,
          storyContent: params.storyContent,
        }),
      },
    ],
    max_tokens: 180,
    temperature: 0.65,
  });

  const text = String(completion.choices[0]?.message?.content ?? "").trim();
  if (text) return text;

  // Fallback: 某些网关/模型偶发返回空内容时，退化为可用的短提示词，避免整个流程失败
  const kw = keywords.slice(0, 12).join(", ");
  const extra = String(params.freeText ?? "").trim();
  const storySnippet = truncateStoryForImagePrompt(String(params.storyContent ?? "").trim(), 220);
  return [
    "bright spacious modern living room, large windows with daylight, sofa coffee table bookshelf, wide interior establishing shot",
    "second shot option: serene neighborhood park green trees paved path wooden bench, medium wide landscape",
    "third shot option: cozy dining room table set chairs pendant light evening ambiance, interior wide shot",
    "no fabric-only frame, no curtain texture close-up, no textile macro, no rug fill-frame",
    "wide shot or medium shot only, full environment visible",
    "no people, no humans, no faces, no text, no watermark",
    params.goalType ? `theme: ${params.goalType}` : "",
    params.goalName ? `goal: ${params.goalName}` : "",
    kw ? `keywords: ${kw}` : "",
    extra ? `notes: ${extra}` : "",
    storySnippet ? `story cues: ${storySnippet}` : "",
  ]
    .filter(Boolean)
    .join(", ");
}

export async function generateDreamImageForStory(input: {
  storyId: string;
  highQuality?: boolean;
}): Promise<{ storyId: string; imageUrls: string[]; model: string }> {
  const imgCfg = getDreamImageConfig();
  if (!imgCfg) throw new Error("dream_image_not_configured");

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");

  const storyId = String(input.storyId ?? "").trim();
  if (!storyId) throw new Error("missing_story_id");
  const highQuality = Boolean(input.highQuality);

  const { data: story, error: storyError } = await supabase
    .from("goal_stories")
    .select("id,goal_id,keywords,free_text,content")
    .eq("id", storyId)
    .maybeSingle();
  if (storyError || !story?.id) throw new Error("story_not_found");

  const { data: goal, error: goalError } = await supabase
    .from("financial_goals")
    .select("id,user_id,name,type")
    .eq("id", story.goal_id)
    .maybeSingle();
  if (goalError || !goal?.id) throw new Error("goal_not_found");
  if (String(goal.user_id) !== auth.user.id) throw new Error("forbidden");

  const goalType = String(goal.type ?? "");
  const useDeterministic =
    isDeterministicHomeShotsEnabled() && shouldUseDeterministicHomeVisuals(goalType, String(story.content ?? ""));
  const imageModel = resolveDreamImageModel(highQuality, imgCfg, useDeterministic);

  const prompt = await generateEnglishImagePrompt({
    goalName: String(goal.name ?? ""),
    goalType,
    keywords: story.keywords,
    freeText: story.free_text,
    storyContent: story.content,
  });

  const basePath = `${auth.user.id}/goals/${String(story.goal_id)}/stories/${storyId}/visual`;
  const imageUrls: string[] = [];
  const shotTotal = dreamVisualShotTarget(highQuality);
  // 部分网关对 n 有严格枚举限制（例如只能 1 或 5），因此我们固定单次 n=1，多次调用得到多张镜头
  const visualBatchEntropy = crypto.randomBytes(5).toString("hex");
  let shotPrompts: string[];
  if (useDeterministic) {
    shotPrompts = Array.from({ length: shotTotal }, (_, i) => deterministicHomeDreamShot(i, visualBatchEntropy));
  } else {
    const dream = getOpenAIDreamConfig();
    if (!dream) throw new Error("dream_openai_not_configured");
    const promptClient = new OpenAI({ apiKey: dream.apiKey, baseURL: dream.baseURL, timeout: 60_000 });
    const promptModel = (process.env.DMX_IMAGE_PROMPT_MODEL ?? dream.translateModel).trim();
    shotPrompts = await generateShotPrompts({
      basePrompt: prompt,
      model: promptModel,
      client: promptClient,
      highQuality,
      n: shotTotal,
      storyText: String(story.content ?? ""),
    });
  }

  for (let i = 0; i < shotTotal; i++) {
    const shotCore = shotPrompts[i] ?? prompt;
    const payload = {
      model: imageModel,
      prompt: finalizeImagePromptForApi(composeFinalImagePrompt(enforceWideMediumOnly(shotCore), goalType)),
      size: DREAM_IMAGE_SIZE,
      n: 1,
    };
    const json = await dmxPostImages({ baseURL: imgCfg.baseURL, apiKey: imgCfg.apiKey, payload });
    try {
      const u = await persistDreamShotFromGeneration({
        json,
        supabase,
        bucketPathPrefix: basePath,
        shotIdx: i,
      });
      imageUrls.push(u);
    } catch {
      // 单张失败则跳过，与其它镜头解耦
    }
  }

  if (imageUrls.length < 1) throw new Error("image_generation_failed");

  // 复用 goal_videos 作为“视觉素材”存储（字段名 video_url，但此处存图片 URL）
  const batchMeta = JSON.stringify({
    ve: visualBatchEntropy,
    prompts: shotPrompts.slice(0, 30),
    target: shotTotal,
    pb: DREAM_VISUAL_PROMPT_BUILD_ID,
  });
  const { error: upsertError } = await supabase.from("goal_videos").upsert(
    {
      story_id: storyId,
      video_url: JSON.stringify(imageUrls),
      status: "succeeded",
      provider_task_id: batchMeta,
      provider_model: imageModel,
      duration_sec: null,
      resolution: null,
      last_error: null,
    },
    { onConflict: "story_id" },
  );
  if (upsertError) throw new Error("db_visual_upsert_failed");

  return { storyId, imageUrls, model: imageModel };
}

async function readExistingVisualState(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  storyId: string,
): Promise<{
  urls: string[];
  prompts: string[];
  target: number;
  refreshFailStreak: number;
  pbMatches: boolean;
  visualEntropy: string | null;
}> {
  const { data } = await supabase
    .from("goal_videos")
    .select("video_url,provider_task_id")
    .eq("story_id", storyId)
    .maybeSingle();
  const raw = String(data?.video_url ?? "").trim();
  const urls = (() => {
    if (!raw) return [];
    if (!raw.startsWith("[")) return [raw];
    try {
      const arr = JSON.parse(raw) as unknown;
      if (Array.isArray(arr)) return arr.map((x) => String(x)).filter(Boolean);
    } catch {
      // ignore
    }
    return [];
  })();

  const meta = (() => {
    const t = String(data?.provider_task_id ?? "").trim();
    if (!t.startsWith("{")) return null;
    try {
      return JSON.parse(t) as Record<string, unknown>;
    } catch {
      return null;
    }
  })();

  const pbMatches = (() => {
    const pbRaw = meta?.pb;
    const pb = typeof pbRaw === "number" ? pbRaw : Number(pbRaw);
    if (!Number.isFinite(pb)) return false;
    return pb === DREAM_VISUAL_PROMPT_BUILD_ID;
  })();

  const prompts = (() => {
    if (!pbMatches) return [];
    const arr = meta?.prompts;
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => String(x)).filter(Boolean);
  })();

  const target = (() => {
    const n = meta?.target;
    const v = typeof n === "number" ? n : Number(n);
    return Number.isFinite(v) && v >= 1 && v <= 30 ? Math.floor(v) : DREAM_VISUAL_SHOTS;
  })();

  const refreshFailStreak = (() => {
    const n = meta?.rf;
    const v = typeof n === "number" ? n : Number(n);
    return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  })();

  const visualEntropy =
    meta?.ve != null && String(meta.ve).trim() ? String(meta.ve).trim() : null;

  return { urls, prompts, target, refreshFailStreak, pbMatches, visualEntropy };
}

async function writeVisualUrls(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  storyId: string;
  urls: string[];
  status: "processing" | "succeeded" | "failed";
  model: string;
  prompts?: string[];
  target?: number;
  /** provider_task_id JSON：同一轮生成共用的随机种子，避免 deterministic 模板每次完全相同 */
  visualEntropy?: string | null;
  /** provider_task_id JSON 里的 rf：补镜头连续失败次数（成功后会清零） */
  refreshFailStreak?: number;
  lastError?: string | null;
}): Promise<void> {
  const meta: Record<string, unknown> = {};
  if (params.prompts?.length) {
    meta.prompts = params.prompts.slice(0, 30);
    meta.pb = DREAM_VISUAL_PROMPT_BUILD_ID;
  }
  if (typeof params.target === "number") meta.target = params.target;
  if (typeof params.refreshFailStreak === "number") meta.rf = params.refreshFailStreak;
  if (params.visualEntropy != null && String(params.visualEntropy).trim())
    meta.ve = String(params.visualEntropy).trim().slice(0, 64);
  const providerTaskId = Object.keys(meta).length ? JSON.stringify(meta) : null;
  const { error } = await params.supabase.from("goal_videos").upsert(
    {
      story_id: params.storyId,
      video_url: JSON.stringify(params.urls),
      status: params.status,
      provider_task_id: providerTaskId,
      provider_model: params.model,
      duration_sec: null,
      resolution: null,
      last_error: params.lastError ?? null,
    },
    { onConflict: "story_id" },
  );
  if (error) throw new Error("db_visual_upsert_failed");
}

/** 像「买房安家」类叙事：用固定整景英文提示，避免部分模型（尤其 Flux ultra）忽略长 prompt 变成抽象布纹 */
function shouldUseDeterministicHomeVisuals(goalType: string, storyContent?: string | null): boolean {
  const t = String(goalType ?? "").trim().toLowerCase();
  if (t === "housing") return true;
  if (/housing|house|home|mortgage|房贷|置业|新居|首付|楼盘|户型|安家|买房/.test(t)) return true;
  const s = String(storyContent ?? "").slice(0, 1800);
  return /新家|家门|客厅|卧室|房贷|收纳|软装|户型|楼盘|餐桌|小区|公园|落地窗|安家|看房|月供|全屋/.test(s);
}

/** 与镜头索引一一对应的纯环境/建筑场景，不出现 fabric / cushion 等易诱发微距布料的词 */
function deterministicHomeDreamShot(shotIdx: number, batchEntropy?: string | null): string {
  const shots = [
    "Photoreal exterior wide modern villa white walls infinity pool sea view stone terrace loungers sunset golden hour empty no people",
    "Photoreal outdoor rose garden curved gravel path heritage rose masses pink coral cream blue sky wide shot no people",
    "Photoreal alpine wildflower meadow hillside distant peaks morning mist wide landscape empty no people",
    "Photoreal wide river gorge hiking trail above turquoise water misty cliffs azalea rhododendron banks pink magenta coral bloom sea empty trail no hikers wide shot no people",
    "Photoreal China national forest park primeval woodland ancient towering trees moss-covered trunks granite stepping path wooden boardwalk god rays mist canopy cathedral grove empty no people wide shot",
    "Photoreal coastal cliff path wooden fence ocean horizon spray sunset wide environmental shot no people",
    "Photoreal botanical garden outdoor walkway rose pergolas formal flower borders manicured wide shot no people",
    "Photoreal suburban street tree-lined houses lawns spring blossom wide shot no people",
    "Photoreal lakeside wooden pier calm water forest reflection soft dawn wide shot no people",
    "Photoreal countryside gravel lane orchard bloom distant hills wide shot no people",
    "Photoreal resort pool deck stone pavers tropical planters palm silhouettes dusk wide shot no people",
    "Photoreal airport runway exterior grassy verge fence empty tarmac distant airplane visible travel mood wide shot no people",
    "Photoreal mountain scenic overlook stone parapet valley mist national park vista wide shot no people",
    "Photoreal evening outdoor terrace dining long table family of four seated eating together flowers candles string lights open sky warm glow wide shot",
  ];
  const base = shots[shotIdx % shots.length] ?? shots[0]!;
  const ent = String(batchEntropy ?? "").trim();
  if (!ent) return base;
  return `${base}, novel composition variation seed ${ent} frame ${shotIdx}`;
}

/** 高质量默认 ultra 常为 Flux：对「整屋」提示易退化成色块/布料；安家类场景改用主模型（如豆包）更稳 */
function resolveDreamImageModel(
  highQuality: boolean,
  imgCfg: { model: string; ultraModel: string },
  preferStableWideScene: boolean,
): string {
  const ultra = String(imgCfg.ultraModel ?? "").toLowerCase();
  if (highQuality && preferStableWideScene && /flux|sdxl|stable-diffusion|mj|midjourney/i.test(ultra)) {
    return String(imgCfg.model).trim();
  }
  return highQuality ? String(imgCfg.ultraModel).trim() : String(imgCfg.model).trim();
}

/** 去掉易诱发布料特写的有毒片段，并把「整景」约束放在提示最前（不少模型更吃前段） */
function sanitizeImagePromptForApi(prompt: string): string {
  const p = String(prompt ?? "")
    .replace(/\bcrisp\s+fabric\s+texture\b/gi, "crisp wood glass and plaster detail")
    .replace(/\bfabric\s+texture\b/gi, "interior surfaces")
    .replace(/\btextile\s+texture\b/gi, "room environment")
    .replace(/\bsoft\s+tungsten\b/gi, "warm tungsten")
    .trim();
  return p.replace(/\s+/g, " ").trim();
}

function leadingSceneConstraintForGoalType(goalType: string | null | undefined): string {
  const t = String(goalType ?? "")
    .trim()
    .toLowerCase();
  if (t === "housing" || t.includes("house") || t.includes("home") || t.includes("房")) {
    return "Professional interior architecture photograph, wide angle, full room in frame with walls windows floor and furniture visible, ";
  }
  if (t === "travel" || t === "car" || t.includes("旅行") || t.includes("车")) {
    return "Outdoor travel photography, wide environmental shot, recognizable place and depth, ";
  }
  return "Photoreal wide environmental photograph, architecture or landscape clearly readable, not an object macro, ";
}

function composeFinalImagePrompt(prompt: string, goalType?: string | null): string {
  const body = sanitizeImagePromptForApi(prompt);
  const head = body.slice(0, 120).toLowerCase();
  const skipLead =
    head.startsWith("photoreal") ||
    head.startsWith("professional interior") ||
    head.startsWith("wide-angle interior") ||
    head.includes("photoreal wide");
  const wantsOutdoor =
    /\b(outdoor|outside|exterior|street|park|garden|forest|mountain|beach|river|lake|skyline|rooftop|terrace|balcony|airport|runway|airplane|plane|jet|flight|train|station|highway|bridge|tree|trees|flower|flowers)\b/i.test(
      body,
    );
  const t = String(goalType ?? "").trim().toLowerCase();
  const isHousingGoal = t === "housing" || t.includes("house") || t.includes("home") || t.includes("房");
  const lead =
    skipLead
      ? ""
      : isHousingGoal && wantsOutdoor
        ? "Photoreal wide environmental photograph, architecture or landscape clearly readable, not an object macro, "
        : leadingSceneConstraintForGoalType(goalType);
  let merged = `${lead}${body}`;
  const wantsCleanArchitecturalFloor =
    /\b(interior|living\s+room|bedroom|kitchen|dining|sunroom|study|home office|rustic|cabin|farmhouse|rocking chair|porch|patio|terrace|balcony|breakfast|al fresco|mediterranean|sun room|courtyard|villa|sliding glass|island|tile|hardwood|terrazzo|terracotta|concrete floor|pavement|deck)\b/i.test(
      merged,
    );
  if (wantsCleanArchitecturalFloor) {
    merged = `${merged}, pristine visible floor, no scattered leaves twigs or loose foliage debris, no loose tree branches or fallen branches on ground, no twig pile or twig bundles, no leafless twigs, no deadwood or driftwood, no cordwood or kindling heaps or firewood bundles, no random green clumps on tile stone or concrete, no heap of blankets or pillows, no beanbag, no fabric mound by window, no yellow throw or blanket rumpled on paving, no books magazines newspapers or papers on floor, no stacked firewood cordwood split logs timber piles kindling heaps log racks in corners near seating or dining`;
  }
  if (/\b(bedroom|bed linens|\bbed\b|duvet|nightstand|bedsheet)\b/i.test(merged)) {
    merged = `${merged}, no vegetable planters or crop beds in bedroom, ornamental flowers only if cut blooms in vase, refined neutral adult bedding only no cartoon or character prints`;
  }
  if (/\b(interior|living\s+room|tile\s+floor|bedroom|kitchen)\b/i.test(merged)) {
    merged = `${merged}, no wooden veg planter boxes or soil troughs inside this interior space`;
  }
  if (
    /\b(bedroom|living\s+room|duvet|\bbed\b|bed linens|minimalist room)\b/i.test(merged) &&
    /\b(planter|planting|trough|lettuce|herb bed|vegetable bed|allotment|soil)\b/i.test(merged)
  ) {
    merged = `${merged}, absolutely NO rectangular planting boxes or soil-filled troughs on interior tile or floor; indoor plants only as small pots on stands or cut flowers in vase on table`;
  }
  if (
    /\b(bedroom|\bbed\b|duvet)\b/i.test(merged) &&
    /\b(runway|airport|airplane|terminal|boarding)\b/i.test(merged)
  ) {
    merged = `${merged}, never combine residential bedroom furniture with runway vista plus indoor cultivation beds in one frame; airport interior shots must stay terminal-only without beds or planters`;
  }
  if (/\b(airport|runway|tarmac|apron|airfield|terminal|boarding gate|concourse)\b/i.test(merged)) {
    merged = `${merged}, aviation hygiene: NO planting boxes soil troughs wood crates lettuce beds along windows NO firewood stacks cordwood NO wheeled trash cans NO beanbags rugs yellow throws NO open books magazines NO Mickey Mouse or cartoon dolls NO scattered leaves debris NO decorative foreground tree trunks; airplanes may be visible; strictly shoot from OUTDOOR airport perimeter, never from inside a room looking out through a window`;
  }
  {
    const outdoorFloral =
      /\b(meadow|hillside|wildflower field|garden border|country lane|orchard|exterior terrace|garden terrace|terrace|patio|pergola|pool deck|balcony|deck|courtyard|lawn|park path|alpine|national park|countryside|outdoor garden)\b/i.test(
        merged,
      );
    if (
      !outdoorFloral &&
      /\b(bedroom|living\s+room|dining\s+room|interior|sunroom|conservatory|enclosed|hall|wainscot|tile floor|hardwood floor)\b/i.test(merged)
    ) {
      merged = `${merged}, indoor floral arrangements in vases urns on etagere plant stands tables mantels only, no blooms covering interior floor as ground cover, no large vase alone on empty floor`;
    } else if (
      /\b(greenhouse|conservatory|botanical|flower border|garden terrace|terrace|patio|pergola|wisteria|orchid|rose bed|lilac|peony)\b/i.test(merged)
    ) {
      merged = `${merged}, abundant open flowers with visible colored petals; if indoor conservatory prefer blooms on benches stands and hanging baskets not soil carpet indoors`;
    }
  }
  if (
    /\b(terrace|patio|pergola|balcony|deck|courtyard|planters?|raised bed)\b/i.test(merged) &&
    /\b(outdoor|exterior|garden|villa|mediterranean)\b/i.test(merged) &&
    !/\b(airport|terminal|runway|tarmac)\b/i.test(merged)
  ) {
    merged = `${merged}, visible colorful open blooms in planters or borders (roses geraniums petunias bougainvillea or similar), reject foliage-only herb boxes or all-green lettuce beds`;
  }
  merged = `${merged}, award-winning editorial photography aesthetic, major motion picture color grading, dimensional cinematic light`;
  return merged.length > 3800 ? merged.slice(0, 3800) : merged;
}

/** 部分网关/模型对完全相同 prompt 会复用缓存或趋于同款；每次调用追加短时戳+随机串打散 */
function finalizeImagePromptForApi(composed: string): string {
  const tok = `${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
  const suffix = `, unique render ${tok}`;
  const max = 3800;
  if (composed.length + suffix.length <= max) return `${composed}${suffix}`;
  return `${composed.slice(0, Math.max(0, max - suffix.length))}${suffix}`;
}

async function generateOneImage(params: {
  baseURL: string;
  apiKey: string;
  model: string;
  prompt: string;
  /** 用于前置强约束场景，减少“只有一块布” */
  goalType?: string | null;
  shotIdx: number;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  bucketPathPrefix: string;
}): Promise<string> {
  const payload = {
    model: params.model,
    prompt: finalizeImagePromptForApi(composeFinalImagePrompt(params.prompt, params.goalType)),
    size: DREAM_IMAGE_SIZE,
    n: 1,
    // 优先要 b64_json：避免部分网关返回的外链域名在某些网络下无法解析
    response_format: "b64_json",
  };
  const json = await dmxPostImages({ baseURL: params.baseURL, apiKey: params.apiKey, payload });
  return persistDreamShotFromGeneration({
    json,
    supabase: params.supabase,
    bucketPathPrefix: params.bucketPathPrefix,
    shotIdx: params.shotIdx,
  });
}

/** 方案 B：先出 1 张，后台补齐到 3 张（通过 refresh 多次补齐） */
export async function submitDreamVisualJob(input: { storyId: string; highQuality?: boolean }): Promise<{
  storyId: string;
  status: "processing" | "succeeded";
  imageUrls: string[];
  pbMatches: true;
  pb: number;
}> {
  const imgCfg = getDreamImageConfig();
  if (!imgCfg) throw new Error("dream_image_not_configured");

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");

  const storyId = String(input.storyId ?? "").trim();
  if (!storyId) throw new Error("missing_story_id");
  const highQuality = Boolean(input.highQuality);
  const target = dreamVisualShotTarget(highQuality);

  const { data: story, error: storyError } = await supabase
    .from("goal_stories")
    .select("id,goal_id,keywords,free_text,content")
    .eq("id", storyId)
    .maybeSingle();
  if (storyError || !story?.id) throw new Error("story_not_found");

  const { data: goal, error: goalError } = await supabase
    .from("financial_goals")
    .select("id,user_id,name,type")
    .eq("id", story.goal_id)
    .maybeSingle();
  if (goalError || !goal?.id) throw new Error("goal_not_found");
  if (String(goal.user_id) !== auth.user.id) throw new Error("forbidden");

  const goalTypeStr = String(goal.type ?? "");
  const storyBody = String(story.content ?? "");
  const useDeterministic =
    isDeterministicHomeShotsEnabled() && shouldUseDeterministicHomeVisuals(goalTypeStr, storyBody);
  const imageModel = resolveDreamImageModel(highQuality, imgCfg, useDeterministic);

  const basePrompt = await generateEnglishImagePrompt({
    goalName: String(goal.name ?? ""),
    goalType: goalTypeStr,
    keywords: story.keywords,
    freeText: story.free_text,
    storyContent: story.content,
  });

  const basePath = `${auth.user.id}/goals/${String(story.goal_id)}/stories/${storyId}/visual`;
  // 点击按钮视为“重新生成一组视觉素材”，覆盖旧的 urls/prompts，避免沿用旧 prompts 导致风格无法刷新
  //（若用户想继续补齐旧的，可以只点“等待/自动补齐”，不重复点按钮）

  const jobVisualEntropy = crypto.randomBytes(5).toString("hex");
  let shotPrompts: string[];
  if (useDeterministic) {
    shotPrompts = Array.from({ length: target }, (_, i) => deterministicHomeDreamShot(i, jobVisualEntropy));
  } else {
    const dream = getOpenAIDreamConfig();
    if (!dream) throw new Error("dream_openai_not_configured");
    const promptClient = new OpenAI({ apiKey: dream.apiKey, baseURL: dream.baseURL, timeout: 60_000 });
    const promptModel = (process.env.DMX_IMAGE_PROMPT_MODEL ?? dream.translateModel).trim();
    shotPrompts = await generateShotPrompts({
      basePrompt,
      model: promptModel,
      client: promptClient,
      highQuality,
      n: target,
      storyText: storyBody,
    });
  }

  let firstUrl: string;
  try {
    firstUrl = await generateOneImage({
      baseURL: imgCfg.baseURL,
      apiKey: imgCfg.apiKey,
      model: imageModel,
      prompt: enforceWideMediumOnly(shotPrompts[0] ?? basePrompt),
      goalType: goalTypeStr,
      shotIdx: 0,
      supabase,
      bucketPathPrefix: basePath,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await writeVisualUrls({
      supabase,
      storyId,
      urls: [],
      status: "failed",
      model: imageModel,
      prompts: shotPrompts,
      target,
      visualEntropy: jobVisualEntropy,
      refreshFailStreak: 0,
      lastError: msg,
    });
    throw e;
  }

  await writeVisualUrls({
    supabase,
    storyId,
    urls: [firstUrl],
    status: "processing",
    model: imageModel,
    prompts: shotPrompts,
    target,
    visualEntropy: jobVisualEntropy,
    refreshFailStreak: 0,
    lastError: null,
  });
  return { storyId, status: "processing", imageUrls: [firstUrl], pbMatches: true, pb: DREAM_VISUAL_PROMPT_BUILD_ID };
}

export async function refreshDreamVisualJob(input: { storyId: string; highQuality?: boolean }): Promise<{
  storyId: string;
  status: "processing" | "succeeded" | "failed";
  imageUrls: string[];
  pbMatches: boolean;
  pb: number;
}> {
  const imgCfg = getDreamImageConfig();
  if (!imgCfg) throw new Error("dream_image_not_configured");

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");

  const storyId = String(input.storyId ?? "").trim();
  if (!storyId) throw new Error("missing_story_id");
  const highQuality = Boolean(input.highQuality);

  const { data: story } = await supabase
    .from("goal_stories")
    .select("goal_id,keywords,free_text,content")
    .eq("id", storyId)
    .maybeSingle();
  if (!story?.goal_id) throw new Error("story_not_found");
  const { data: goal } = await supabase.from("financial_goals").select("user_id,name,type").eq("id", story.goal_id).maybeSingle();
  if (!goal?.user_id || String(goal.user_id) !== auth.user.id) throw new Error("forbidden");

  const goalTypeStr = String(goal.type ?? "");
  const storyBody = String(story.content ?? "");
  const useDeterministic =
    isDeterministicHomeShotsEnabled() && shouldUseDeterministicHomeVisuals(goalTypeStr, storyBody);
  const imageModel = resolveDreamImageModel(highQuality, imgCfg, useDeterministic);

  const existing = await readExistingVisualState(supabase, storyId);
  const urls = existing.urls;
  // 必须与 submitDreamVisualJob 一致：高质量 3 张、普通 6 张（readExistingVisualState 缺省偏普通 6）
  const target = dreamVisualShotTarget(highQuality);
  if (urls.length >= target) {
    return {
      storyId,
      status: "succeeded",
      imageUrls: urls.slice(0, target),
      pbMatches: existing.pbMatches,
      pb: DREAM_VISUAL_PROMPT_BUILD_ID,
    };
  }

  const basePrompt = await generateEnglishImagePrompt({
    goalName: String(goal.name ?? ""),
    goalType: goalTypeStr,
    keywords: story.keywords,
    freeText: story.free_text,
    storyContent: story.content,
  });
  const basePath = `${auth.user.id}/goals/${String(story.goal_id)}/stories/${storyId}/visual`;

  const jobVisualEntropy = existing.visualEntropy?.trim() || crypto.randomBytes(5).toString("hex");

  try {
    const nextIdx = urls.length;
    let prompts = existing.prompts;
    if (useDeterministic) {
      prompts = Array.from({ length: target }, (_, i) => deterministicHomeDreamShot(i, jobVisualEntropy));
    } else if (prompts.length < target) {
      const dream = getOpenAIDreamConfig();
      if (dream) {
        const promptClient = new OpenAI({ apiKey: dream.apiKey, baseURL: dream.baseURL, timeout: 60_000 });
        const promptModel = (process.env.DMX_IMAGE_PROMPT_MODEL ?? dream.translateModel).trim();
        prompts = await generateShotPrompts({
          basePrompt,
          model: promptModel,
          client: promptClient,
          highQuality,
          n: target,
          storyText: storyBody,
        });
      }
    }

    const promptForShot = enforceWideMediumOnly(
      useDeterministic
        ? deterministicHomeDreamShot(nextIdx, jobVisualEntropy)
        : (prompts[nextIdx] ?? addShotVariation(basePrompt, nextIdx)),
    );
    const nextUrl = await generateOneImage({
      baseURL: imgCfg.baseURL,
      apiKey: imgCfg.apiKey,
      model: imageModel,
      prompt: promptForShot,
      goalType: goalTypeStr,
      shotIdx: nextIdx,
      supabase,
      bucketPathPrefix: basePath,
    });
    // 客户端每 2.5s 轮询会并发多个 refresh；慢请求若仍用进入时的 `urls` 做 [...urls, nextUrl] 写库，
    // 会把已生成到 6 张的 video_url 覆盖成更短数组，表现为只能切换前一两张。写前必须重读并避免用旧快照覆盖。
    const latest = await readExistingVisualState(supabase, storyId);
    if (latest.urls.length >= target) {
      return {
        storyId,
        status: "succeeded" as const,
        imageUrls: latest.urls.slice(0, target),
        pbMatches: latest.pbMatches,
        pb: DREAM_VISUAL_PROMPT_BUILD_ID,
      };
    }
    if (latest.urls.length > urls.length) {
      return {
        storyId,
        status: latest.urls.length >= target ? ("succeeded" as const) : ("processing" as const),
        imageUrls: latest.urls,
        pbMatches: latest.pbMatches,
        pb: DREAM_VISUAL_PROMPT_BUILD_ID,
      };
    }
    if (latest.urls.length < urls.length) {
      return {
        storyId,
        status: latest.urls.length >= target ? ("succeeded" as const) : ("processing" as const),
        imageUrls: latest.urls,
        pbMatches: latest.pbMatches,
        pb: DREAM_VISUAL_PROMPT_BUILD_ID,
      };
    }
    const nextUrls = [...latest.urls, nextUrl].slice(0, target);
    await writeVisualUrls({
      supabase,
      storyId,
      urls: nextUrls,
      status: nextUrls.length >= target ? "succeeded" : "processing",
      model: imageModel,
      prompts: prompts.length ? prompts : undefined,
      target,
      visualEntropy: jobVisualEntropy,
      refreshFailStreak: 0,
      lastError: null,
    });
    return {
      storyId,
      status: nextUrls.length >= target ? "succeeded" : "processing",
      imageUrls: nextUrls,
      pbMatches: true,
      pb: DREAM_VISUAL_PROMPT_BUILD_ID,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    const nextRf = existing.refreshFailStreak + 1;
    if (nextRf >= DREAM_VISUAL_MAX_REFRESH_FAILS) {
      await writeVisualUrls({
        supabase,
        storyId,
        urls,
        status: "failed",
        model: imageModel,
        prompts: existing.prompts.length ? existing.prompts : undefined,
        target,
        visualEntropy: jobVisualEntropy,
        refreshFailStreak: nextRf,
        lastError: msg,
      });
      return { storyId, status: "failed", imageUrls: urls, pbMatches: existing.pbMatches, pb: DREAM_VISUAL_PROMPT_BUILD_ID };
    }
    await writeVisualUrls({
      supabase,
      storyId,
      urls,
      status: "processing",
      model: imageModel,
      prompts: existing.prompts.length ? existing.prompts : undefined,
      target,
      visualEntropy: jobVisualEntropy,
      refreshFailStreak: nextRf,
      lastError: msg,
    });
    return { storyId, status: "processing", imageUrls: urls, pbMatches: existing.pbMatches, pb: DREAM_VISUAL_PROMPT_BUILD_ID };
  }
}

// Seedance 1.5 Pro（responses）：常见约束 duration ∈ [4, 12]
// 产品默认：固定 12 秒（无声 720p，成本更可控）
const DEFAULT_SEEDANCE_VIDEO_SECONDS = 12 as const;
const VIDU_SEGMENT_COUNT = 3 as const;

function buildVideoPromptSystem(): string {
  return [
    "You write short English prompts for cinematic text-to-video generation.",
    "Hard requirements:",
    "- Output MUST be a single English prompt string only.",
    "- Max 25 words.",
    "- Must end with: , no text, no letters, no watermark",
    "- No quotes, no markdown, no bullet points.",
    "Style: warm, realistic lifestyle B-roll, gentle camera motion, natural light.",
  ].join("\n");
}

function buildVideoPromptUser(params: {
  goalName: string;
  goalType: string;
  keywords: string[];
  freeText?: string | null;
}): string {
  const kw = params.keywords.slice(0, 20).join(", ");
  const extra = String(params.freeText ?? "").trim();
  return [
    `Financial goal type: ${params.goalType}`,
    `Goal title: ${params.goalName}`,
    kw ? `Keywords: ${kw}` : "",
    extra ? `Notes: ${extra}` : "",
    "",
    "Focus on hopeful daily-life imagery related to achieving the goal (home, travel, family time, calm routines). Avoid logos/brands.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function generateEnglishVideoPrompt(params: {
  goalName: string;
  goalType: string;
  keywords: unknown;
  freeText?: string | null;
}): Promise<string> {
  const dream = getOpenAIDreamConfig();
  const videoCfg = getDmxVideoConfig();
  if (!dream || !videoCfg) throw new Error("dream_openai_not_configured");

  const client = new OpenAI({ apiKey: dream.apiKey, baseURL: dream.baseURL, timeout: 60_000 });
  const keywords = Array.isArray(params.keywords)
    ? params.keywords.map((x) => String(x)).filter(Boolean)
    : [];

  const completion = await client.chat.completions.create({
    model: videoCfg.promptModel,
    messages: [
      { role: "system", content: buildVideoPromptSystem() },
      {
        role: "user",
        content: buildVideoPromptUser({
          goalName: params.goalName,
          goalType: params.goalType,
          keywords,
          freeText: params.freeText,
        }),
      },
    ],
    max_tokens: 180,
    temperature: 0.8,
  });

  const text = String(completion.choices[0]?.message?.content ?? "").trim();
  if (!text) throw new Error("empty_prompt");
  return text;
}

export async function submitDreamVideoJob(input: {
  storyId: string;
}): Promise<{ storyId: string; taskId: string; durationSec: typeof DEFAULT_SEEDANCE_VIDEO_SECONDS }> {
  const videoCfg = getDmxVideoConfig();
  if (!videoCfg) throw new Error("dream_video_not_configured");

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");

  const storyId = String(input.storyId ?? "").trim();
  if (!storyId) throw new Error("missing_story_id");

  const durationSec = DEFAULT_SEEDANCE_VIDEO_SECONDS;

  const { data: story, error: storyError } = await supabase
    .from("goal_stories")
    .select("id,goal_id,keywords,free_text,locale")
    .eq("id", storyId)
    .maybeSingle();
  if (storyError || !story?.id) throw new Error("story_not_found");

  const { data: goal, error: goalError } = await supabase
    .from("financial_goals")
    .select("id,user_id,name,type")
    .eq("id", story.goal_id)
    .maybeSingle();
  if (goalError || !goal?.id) throw new Error("goal_not_found");
  if (String(goal.user_id) !== auth.user.id) throw new Error("forbidden");

  const prompt = await generateEnglishVideoPrompt({
    goalName: String(goal.name ?? ""),
    goalType: String(goal.type ?? ""),
    keywords: story.keywords,
    freeText: story.free_text,
  });

  const submitModel = String(videoCfg.submitModel ?? "").trim();

  // Vidu 2.0：单段固定 4s，我们以 3 段连播≈12s 的方式呈现
  if (submitModel.toLowerCase().startsWith("vidu")) {
    const modelForVideos = (() => {
      const m = submitModel.trim();
      if (m === "vidu2.0") return "vidu/vidu-2.0";
      if (m === "vidu2.0" || m === "vidu 2.0") return "vidu/vidu-2.0";
      if (m === "vidu1.5") return "vidu/vidu-1.5";
      if (m.toLowerCase().startsWith("vidu/")) return m;
      return m;
    })();

    const taskIds: string[] = [];
    for (let i = 0; i < VIDU_SEGMENT_COUNT; i++) {
      const payload = {
        model: modelForVideos,
        prompt,
      };
      const submitJson = await dmxPostVideos({ baseURL: videoCfg.baseURL, apiKey: videoCfg.apiKey, payload });
      taskIds.push(extractVideoId(submitJson));
    }

    const taskId = JSON.stringify(taskIds);
    const { error: upsertVideoError } = await supabase.from("goal_videos").upsert(
      {
        story_id: storyId,
        video_url: null,
        status: "processing",
        provider_task_id: taskId,
        provider_model: modelForVideos,
        duration_sec: durationSec,
        resolution: "720p",
        last_error: null,
      },
      { onConflict: "story_id" },
    );
    if (upsertVideoError) throw new Error("db_video_upsert_failed");

    return { storyId, taskId, durationSec };
  }

  const payload = {
    model: submitModel,
    input: [{ type: "text", text: prompt }],
    ratio: "16:9",
    resolution: "720p",
    duration: durationSec,
    generate_audio: false,
    watermark: false,
    return_last_frame: false,
    callback_url: "",
  };

  const submitJson = await dmxPostResponses({ baseURL: videoCfg.baseURL, apiKey: videoCfg.apiKey, payload });
  const taskId = extractSeedanceTaskId(submitJson);

  const { error: upsertVideoError } = await supabase.from("goal_videos").upsert(
    {
      story_id: storyId,
      video_url: null,
      status: "processing",
      provider_task_id: taskId,
      provider_model: videoCfg.submitModel,
      duration_sec: durationSec,
      resolution: "720p",
      last_error: null,
    },
    { onConflict: "story_id" },
  );
  if (upsertVideoError) throw new Error("db_video_upsert_failed");

  return { storyId, taskId, durationSec };
}

export async function refreshDreamVideoJob(input: { storyId: string }): Promise<{
  storyId: string;
  status: "processing" | "succeeded" | "failed";
  videoUrl: string | null;
  videoUrls: string[] | null;
}> {
  const videoCfg = getDmxVideoConfig();
  if (!videoCfg) throw new Error("dream_video_not_configured");

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");

  const storyId = String(input.storyId ?? "").trim();
  if (!storyId) throw new Error("missing_story_id");

  const { data: row, error } = await supabase
    .from("goal_videos")
    .select("story_id,status,video_url,provider_task_id")
    .eq("story_id", storyId)
    .maybeSingle();
  if (error || !row?.provider_task_id) throw new Error("video_job_not_found");

  const { data: story } = await supabase.from("goal_stories").select("goal_id").eq("id", storyId).maybeSingle();
  if (!story?.goal_id) throw new Error("story_not_found");
  const { data: goal } = await supabase.from("financial_goals").select("user_id").eq("id", story.goal_id).maybeSingle();
  if (!goal?.user_id || String(goal.user_id) !== auth.user.id) throw new Error("forbidden");

  if (String(row.status) === "succeeded" && row.video_url) {
    const raw = String(row.video_url);
    if (raw.trim().startsWith("[")) {
      try {
        const arr = JSON.parse(raw) as unknown;
        if (Array.isArray(arr)) {
          const urls = arr.map((x) => String(x)).filter(Boolean);
          if (urls.length) return { storyId, status: "succeeded", videoUrl: urls[0] ?? null, videoUrls: urls };
        }
      } catch {
        // ignore
      }
    }
    return { storyId, status: "succeeded", videoUrl: raw, videoUrls: null };
  }

  const providerTaskRaw = String(row.provider_task_id);
  // Vidu：provider_task_id 为 JSON 数组字符串
  if (providerTaskRaw.trim().startsWith("[")) {
    let taskIds: string[] = [];
    try {
      const arr = JSON.parse(providerTaskRaw) as unknown;
      if (Array.isArray(arr)) taskIds = arr.map((x) => String(x)).filter(Boolean);
    } catch {
      taskIds = [];
    }
    if (!taskIds.length) throw new Error("video_job_not_found");

    const urls: string[] = [];
    for (const tid of taskIds) {
      const json = await dmxGetVideoById({ baseURL: videoCfg.baseURL, apiKey: videoCfg.apiKey, id: tid });
      const found = extractAnyVideoUrls(json);
      if (found.length) urls.push(found[0]!);
    }

    if (urls.length === taskIds.length) {
      const encoded = JSON.stringify(urls);
      const { error: updError } = await supabase
        .from("goal_videos")
        .update({
          status: "succeeded",
          video_url: encoded,
          last_error: null,
        })
        .eq("story_id", storyId);
      if (updError) throw new Error("db_video_update_failed");
      return { storyId, status: "succeeded", videoUrl: urls[0] ?? null, videoUrls: urls };
    }

    return { storyId, status: "processing", videoUrl: null, videoUrls: null };
  }

  const getPayload = {
    model: videoCfg.getModel,
    input: providerTaskRaw,
    stream: false,
  };

  const getJson = await dmxPostResponses({ baseURL: videoCfg.baseURL, apiKey: videoCfg.apiKey, payload: getPayload });
  const parsed = parseSeedanceGetResult(getJson);

  if (parsed.status === "succeeded") {
    const { error: updError } = await supabase
      .from("goal_videos")
      .update({
        status: "succeeded",
        video_url: parsed.videoUrl,
        last_error: null,
      })
      .eq("story_id", storyId);
    if (updError) throw new Error("db_video_update_failed");
    return { storyId, status: "succeeded", videoUrl: parsed.videoUrl, videoUrls: null };
  }

  if (parsed.status === "failed") {
    const { error: updError } = await supabase
      .from("goal_videos")
      .update({
        status: "failed",
        last_error: parsed.message ?? "failed",
      })
      .eq("story_id", storyId);
    if (updError) throw new Error("db_video_update_failed");
    return { storyId, status: "failed", videoUrl: null, videoUrls: null };
  }

  return { storyId, status: "processing", videoUrl: null, videoUrls: null };
}

