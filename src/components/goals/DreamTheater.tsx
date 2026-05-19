"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import type { Locale } from "@/i18n/locales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  dreamLocalizedMediaRateLimitError,
  dreamStoryRateLimitError,
  dreamVisualHqPlusRequiredError,
  dreamVisualHqRateLimitError,
  dreamVisualPlusRequiredError,
  dreamVisualRateLimitError,
} from "@/lib/env";
import { cn } from "@/lib/utils";
import {
  generateLocalizedStoryMedia,
  refreshDreamVisualJob,
  submitDreamVisualJob,
  generateStoryForGoal,
} from "@/app/[locale]/goals/dream-theater-actions";

type GoalContext = {
  id: string;
  name: string;
  type: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string | null;
};

const PRESET_KEYWORDS: Record<string, { zh: string[]; en: string[] }> = {
  housing: {
    zh: ["阳光客厅", "孩子房间", "舒适床品", "厨房烟火气", "步行上班", "社区公园", "收纳有序", "仪式感晚餐", "稳定房贷压力", "周末家庭时光"],
    en: [
      "sunny living room",
      "kids' room",
      "cozy bedding",
      "home-cooked dinners",
      "walkable commute",
      "nearby park",
      "organized storage",
      "weekend family time",
      "peace of mind",
      "a place to call home",
    ],
  },
  travel: {
    zh: ["清晨海风", "街头咖啡", "慢旅行", "当地市集", "日落徒步", "轻装出发", "拍照留念", "说走就走", "和家人同行", "心态放松"],
    en: [
      "morning sea breeze",
      "street coffee",
      "slow travel",
      "local markets",
      "sunset hike",
      "pack light",
      "photos and memories",
      "spontaneous trips",
      "travel with family",
      "fully recharged",
    ],
  },
  retirement: {
    zh: ["田园生活", "环球旅行", "晨练散步", "读书写字", "陪伴家人", "养花种菜", "兴趣小班", "慢节奏", "健康管理", "自由时间"],
    en: [
      "quiet countryside",
      "world travel",
      "morning walks",
      "reading and writing",
      "time with family",
      "garden and plants",
      "hobby classes",
      "slow mornings",
      "healthy routines",
      "freedom of time",
    ],
  },
  education: {
    zh: ["安心学费", "兴趣培养", "交换项目", "导师引导", "图书馆", "夏令营", "自信表达", "视野开阔", "家庭支持", "不为钱焦虑"],
    en: [
      "tuition peace of mind",
      "hobbies and growth",
      "exchange program",
      "great mentors",
      "library afternoons",
      "summer camp",
      "confident speaking",
      "wider horizons",
      "family support",
      "no money anxiety",
    ],
  },
  emergency: {
    zh: ["从容应对", "不慌不忙", "医疗备用", "家庭安全感", "不再透支", "睡个好觉", "备用现金流", "稳住生活", "缓冲期", "重新出发"],
    en: [
      "calm response",
      "no panic",
      "medical buffer",
      "family safety",
      "no more overdraft",
      "sleep well",
      "cash cushion",
      "steady life",
      "breathing room",
      "restart confidently",
    ],
  },
  car: {
    zh: ["周末郊游", "通勤更稳", "安全座椅", "带父母出行", "露营装备", "音乐与路", "从容停车", "不再挤地铁", "冬天暖风", "驾驶乐趣"],
    en: [
      "weekend road trips",
      "smoother commute",
      "safety first",
      "drive parents around",
      "camping gear",
      "music on the road",
      "easy parking",
      "no crowded subway",
      "warm winter rides",
      "driving joy",
    ],
  },
  debt: {
    zh: ["松一口气", "账单清零", "利息停止", "重新规划", "轻装前行", "更敢选择", "不再回避", "稳定现金流", "恢复自信", "未来可期"],
    en: [
      "a deep breath",
      "bills cleared",
      "interest stops",
      "fresh plan",
      "travel lighter",
      "more choices",
      "no avoidance",
      "steady cash flow",
      "confidence back",
      "future feels open",
    ],
  },
  medical: {
    zh: ["体检无忧", "更好照护", "康复时间", "安心用药", "专业医生", "家人陪伴", "不再拖延", "健康优先", "更少焦虑", "踏实生活"],
    en: [
      "checkups without worry",
      "better care",
      "time to recover",
      "proper medication",
      "trusted doctors",
      "family support",
      "no more delays",
      "health first",
      "less anxiety",
      "steady living",
    ],
  },
};

function normalizeKeywordInput(raw: string): string[] {
  return raw
    .split(/[,\n，]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function DreamTheater(props: { goal: GoalContext; pageLocale: Locale; isPlusMember: boolean }) {
  const { goal, pageLocale, isPlusMember } = props;
  const [open, setOpen] = useState(false);
  const [moduleLocale, setModuleLocale] = useState<Locale>(pageLocale);

  const [selected, setSelected] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [freeText, setFreeText] = useState("");

  const [storyId, setStoryId] = useState<string>("");
  const [storyByLocale, setStoryByLocale] = useState<Record<string, string>>({});
  const [audioByLocale, setAudioByLocale] = useState<Record<string, string>>({});
  const [subtitleByLocale, setSubtitleByLocale] = useState<Record<string, string>>({});

  const [visualUrls, setVisualUrls] = useState<string[]>([]);
  const [visualIndex, setVisualIndex] = useState(0);
  const [visualStatus, setVisualStatus] = useState<"idle" | "processing" | "succeeded" | "failed">("idle");
  const [visualHQ, setVisualHQ] = useState(false);
  const [visualPbMatches, setVisualPbMatches] = useState<boolean | null>(null);
  /** 勿与全局 pending 共用：旁白/翻译进行时 pending 会一直为 true，导致「生成画面」按钮被误禁用，状态永远「未开始」 */
  const [visualSubmitting, setVisualSubmitting] = useState(false);
  const [lastVisualHQ, setLastVisualHQ] = useState<boolean | null>(null);
  // 用户手动切换镜头后，短暂暂停自动轮播，避免“点了又跳回去”的体感
  const [visualAutoPlayPauseUntil, setVisualAutoPlayPauseUntil] = useState<number>(0);

  const visualUrlsRef = useRef(visualUrls);
  visualUrlsRef.current = visualUrls;

  /** 单张画面偶发 404/过期/解码失败时整块留白；用加载态 + onError + 带参重试缓解 */
  const [visualImgReady, setVisualImgReady] = useState(false);
  const [visualImgFailed, setVisualImgFailed] = useState(false);
  const [visualImgRetryTick, setVisualImgRetryTick] = useState(0);
  /** 与 `/api/ai-usage` 的 dream_visual 一致；null 表示尚未拉取 */
  const [dreamVisualRemaining, setDreamVisualRemaining] = useState<number | null>(null);
  const [dreamVisualLimit, setDreamVisualLimit] = useState(3);
  const [dreamVisualHqRemaining, setDreamVisualHqRemaining] = useState<number | null>(null);
  const [dreamVisualHqLimit, setDreamVisualHqLimit] = useState(0);
  const [imageCreditsStandard, setImageCreditsStandard] = useState(0);
  const [imageCreditsHq, setImageCreditsHq] = useState(0);
  const [dreamStoryRemaining, setDreamStoryRemaining] = useState<number | null>(null);
  const [dreamStoryLimit, setDreamStoryLimit] = useState(5);
  const [dreamLocalizedMediaRemaining, setDreamLocalizedMediaRemaining] = useState<number | null>(null);
  const [dreamLocalizedMediaLimit, setDreamLocalizedMediaLimit] = useState(5);
  const currentVisualUrl = visualUrls[visualIndex] ?? "";

  const visualDisplaySrc = useMemo(() => {
    if (!currentVisualUrl) return "";
    if (visualImgRetryTick === 0) return currentVisualUrl;
    const sep = currentVisualUrl.includes("?") ? "&" : "?";
    return `${currentVisualUrl}${sep}retry=${visualImgRetryTick}`;
  }, [currentVisualUrl, visualImgRetryTick]);

  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string>("");

  const presets = useMemo(() => {
    const bucket = PRESET_KEYWORDS[goal.type] ?? PRESET_KEYWORDS.travel;
    return moduleLocale === "zh" ? bucket.zh : bucket.en;
  }, [goal.type, moduleLocale]);

  const uiText = useMemo(() => {
    const zh = moduleLocale === "zh";
    return {
      title: zh ? "梦想剧场" : "Dream Theater",
      subtitle: zh ? "用你的目标与关键词生成一段未来生活的画面感小作文。" : "Generate a vivid dream story from your goal and keywords.",
      localeZh: "中文",
      localeEn: "EN",
      keywords: zh ? "关键词" : "Keywords",
      customKeywords: zh ? "自定义关键词" : "Custom keywords",
      customPlaceholder: zh ? "可用逗号分隔，例如：海边, 咖啡, 自由时间" : "Comma-separated, e.g. beach, coffee, free time",
      freeText: zh ? "补充描述（选填）" : "Extra description (optional)",
      freeTextPlaceholder: zh ? "例如：我希望实现后能和家人一起慢慢旅行，不赶行程。" : "E.g., I want slow travel with my family, no rushing.",
      generate: zh ? "生成梦想小作文" : "Generate story",
      genMedia: zh ? "生成旁白与字幕" : "Generate narration & subtitles",
      translating: zh ? "正在切换语言…" : "Switching language…",
      story: zh ? "小作文" : "Story",
      hintNeedStory: zh ? "请先生成小作文，再切换语言。" : "Generate a story first, then switch language.",
      narration: zh ? "旁白" : "Narration",
      subtitles: zh ? "字幕" : "Subtitles",
      visualTitle: zh ? "梦想画面（文生图）" : "Dream visual (text-to-image)",
      visualHint: zh ? "说明：生成无水印、无文字的氛围画面，用于搭配旁白/字幕。" : "Generates watermark-free, text-free visuals for narration/subtitles.",
      visualMultiShot: zh
        ? "多镜头对应故事里的不同场景（随关键词变化）；箭头或 ← → 切换。"
        : "Multiple shots follow your story; arrows or ← →.",
      genVisual: zh ? "生成图片画面" : "Generate image",
      visualHQ: zh ? "高质量（Plus 专属 · 单独计次）" : "High quality (Plus only · separate quota)",
      visualHqPlusOnly: zh ? "高质量画面仅 Plus 会员可用，请升级后使用。" : "High-quality visuals are available on Plus only.",
      visualPlusOnly: zh ? "文生图画面需 Plus 会员，请升级后使用。" : "Dream visuals require Plus. Upgrade to generate images.",
      visualProcessing: zh ? "图片生成中…" : "Generating image…",
      visualProcessingPartial: zh ? "预览已就绪，其余镜头生成中…" : "Preview ready; finishing remaining shots…",
      visualReady: zh ? "已生成" : "Ready",
      visualFailed: zh ? "失败" : "Failed",
      visualImgLoading: zh ? "画面加载中…" : "Loading image…",
      visualImgError: zh ? "该镜头画面加载失败（链接可能暂时不可用）。" : "This shot failed to load.",
      visualImgRetry: zh ? "重试加载" : "Retry",
      visualRuleUpdated: zh ? "规则已更新：当前为旧画面，点击「重新生成画面」刷新。" : "Rules updated: showing older visuals. Click Regenerate to refresh.",
      visualQuotaLine: (rem: number, lim: number) =>
        zh
          ? `今日普通画面：剩余 ${rem}/${lim}（每次「生成/重新生成」并成功启动计 1 次，自动补镜头不计）`
          : `Standard visuals today: ${rem}/${lim} left (each Generate/Regenerate start counts once; auto fill-ins do not).`,
      visualHqQuotaLine: (rem: number, lim: number) =>
        zh
          ? `今日高质量画面：剩余 ${rem}/${lim}（与普通画面分开计次，每次 3 镜头）`
          : `HQ visuals today: ${rem}/${lim} left (separate quota; 3 shots per run).`,
      imageCreditsStandardLine: (n: number) =>
        zh ? `加量包（普通镜头）：剩余 ${n} 张` : `Add-on pack (standard shots): ${n} left`,
      imageCreditsHqLine: (n: number) =>
        zh ? `加量包（高质量镜头）：剩余 ${n} 张` : `Add-on pack (HQ shots): ${n} left`,
      visualRateLimitBuyPack: zh
        ? "今日额度已用完。Plus 可购买加量包继续生成。"
        : "Daily quota used up. Plus members can buy an add-on pack to continue.",
      buyPackLink: zh ? "去购买加量包" : "Buy add-on pack",
      storyQuotaLine: (rem: number, lim: number) =>
        zh
          ? `今日小作文：剩余 ${rem}/${lim}（相同关键词与描述命中缓存时不扣次）`
          : `Dream stories today: ${rem}/${lim} left (cache hits for the same inputs do not count).`,
      mediaQuotaLine: (rem: number, lim: number) =>
        zh
          ? `今日旁白/字幕/翻译：剩余 ${rem}/${lim}（已有该语言产物命中缓存时不扣次）`
          : `Narration/subtitles/translation today: ${rem}/${lim} left (cached locale media does not count).`,
      usageMigrationHint: zh
        ? "用量统计暂不可用：请在 Supabase SQL 编辑器为 ai_usage 表补齐 dream_visual_count、dream_story_count、dream_localized_media_count 列（见仓库 supabase/migrations）。"
        : "Usage tracking unavailable: add dream_visual_count, dream_story_count, and dream_localized_media_count on ai_usage in Supabase (see supabase/migrations).",
    };
  }, [moduleLocale]);

  const localizedMediaRateLimitMessage = useCallback(
    () =>
      moduleLocale === "zh"
        ? `今日旁白/字幕/翻译次数已达上限（每天 ${dreamLocalizedMediaLimit} 次），请明日再试。`
        : `Daily narration/subtitle/translation limit reached (${dreamLocalizedMediaLimit}/day). Try again tomorrow.`,
    [moduleLocale, dreamLocalizedMediaLimit],
  );

  useEffect(() => {
    if (!isPlusMember && visualHQ) setVisualHQ(false);
  }, [isPlusMember, visualHQ]);

  const shotsNeeded = visualHQ ? 3 : 6;
  const dailyVisualRemaining = visualHQ ? dreamVisualHqRemaining : dreamVisualRemaining;
  const packVisualRemaining = visualHQ ? imageCreditsHq : imageCreditsStandard;
  const canUseDaily = dailyVisualRemaining === null || dailyVisualRemaining > 0;
  const canUsePack = isPlusMember && packVisualRemaining >= shotsNeeded;

  const visualGenerateDisabled =
    visualStatus === "processing" ||
    !isPlusMember ||
    (dailyVisualRemaining !== null && !canUseDaily && !canUsePack);

  const currentStory = storyByLocale[moduleLocale] || "";
  const currentAudio = audioByLocale[moduleLocale] || "";
  const currentSubtitle = subtitleByLocale[moduleLocale] || "";

  const toggleKeyword = (k: string) => {
    setSelected((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  };

  const onGenerate = () => {
    setErr("");
    const customKeywords = normalizeKeywordInput(customInput);
    // 隐式风格触发：当用户点了“慢节奏/自由时间”一类关键词时，自动注入桃花林/樱花林风格词
    const allKws = [...selected, ...customKeywords].map((s) => String(s ?? "").trim());
    const joined = allKws.join(" ").toLowerCase();
    const hasSlow =
      allKws.includes("慢节奏") || /slow\s*(pace|mornings|living|travel|life)|slow\b/.test(joined);
    const hasFree =
      allKws.includes("自由时间") || /free\s*time|leisure|spare time/.test(joined);
    const blossomKw = (() => {
      if (!(hasSlow || hasFree)) return "";
      // 规则：优先“樱花林”用于慢节奏；否则“桃花林”用于自由时间
      if (hasSlow) return moduleLocale === "zh" ? "樱花林" : "cherry blossom grove";
      return moduleLocale === "zh" ? "桃花林" : "peach blossom grove";
    })();
    const styleKeywords = blossomKw ? [blossomKw] : [];
    startTransition(async () => {
      const res = await generateStoryForGoal({
        goalId: goal.id,
        selectedKeywords: selected,
        customKeywords: [...customKeywords, ...styleKeywords],
        freeText,
        locale: moduleLocale,
      });
      if (!res.ok) {
        const msg = res.error;
        if (msg === dreamStoryRateLimitError) {
          setErr(
            moduleLocale === "zh"
              ? `今日梦想小作文次数已达上限（每天 ${dreamStoryLimit} 次），请明日再试或微调关键词后重试。`
              : `Daily dream story limit reached (${dreamStoryLimit}/day). Try again tomorrow or tweak keywords.`,
          );
        } else if (msg === "dream_openai_not_configured") {
          setErr(
            moduleLocale === "zh"
              ? "梦想剧场 AI 未配置：请在 Vercel / .env.local 设置 OPENAI_API_KEY 或 DMX_API_KEY。"
              : "Dream Theater AI is not configured (set OPENAI_API_KEY or DMX_API_KEY on the server).",
          );
        } else if (msg === "usage_query_failed" || msg === "usage_write_failed") {
          setErr(uiText.usageMigrationHint);
        } else if (msg === "db_insert_failed") {
          setErr(
            moduleLocale === "zh"
              ? "保存小作文失败：请确认 Supabase 已创建 goal_stories 表及权限。"
              : "Could not save the story. Check goal_stories table and RLS in Supabase.",
          );
        } else {
          setErr(msg);
        }
        return;
      }
      setStoryId(res.storyId);
      setStoryByLocale((prev) => ({ ...prev, [res.locale]: res.content }));
      if (!res.cached) void refreshDreamTheaterUsageQuotas();
    });
  };

  const onSwitchLocale = (next: Locale) => {
    if (next === moduleLocale) return;
    setErr("");

    // 无 story 时只切 UI，不触发服务端（避免“空上下文翻译”）
    if (!storyId) {
      setModuleLocale(next);
      setErr(uiText.hintNeedStory);
      return;
    }

    setModuleLocale(next);
    if (storyByLocale[next]) return;

    startTransition(async () => {
      try {
        const res = await generateLocalizedStoryMedia({ storyId, newLocale: next });
        setStoryByLocale((prev) => ({ ...prev, [res.locale]: res.content }));
        if (res.audioUrl) setAudioByLocale((prev) => ({ ...prev, [res.locale]: res.audioUrl! }));
        if (res.subtitleUrl) setSubtitleByLocale((prev) => ({ ...prev, [res.locale]: res.subtitleUrl! }));
        if (res.mediaError) setErr(res.mediaError);
        if (!res.cached) void refreshDreamTheaterUsageQuotas();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown";
        if (msg === dreamLocalizedMediaRateLimitError) {
          setErr(localizedMediaRateLimitMessage());
        } else if (msg === "usage_query_failed" || msg === "usage_write_failed") {
          setErr(uiText.usageMigrationHint);
        } else {
          setErr(msg);
        }
      }
    });
  };

  const onGenerateMedia = () => {
    if (!storyId) return;
    setErr("");
    startTransition(async () => {
      try {
        const res = await generateLocalizedStoryMedia({ storyId, newLocale: moduleLocale, ensureAudioSubtitle: true });
        setStoryByLocale((prev) => ({ ...prev, [res.locale]: res.content }));
        if (res.audioUrl) setAudioByLocale((prev) => ({ ...prev, [res.locale]: res.audioUrl! }));
        if (res.subtitleUrl) setSubtitleByLocale((prev) => ({ ...prev, [res.locale]: res.subtitleUrl! }));
        if (res.mediaError) setErr(res.mediaError);
        if (!res.cached) void refreshDreamTheaterUsageQuotas();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown";
        if (msg === dreamLocalizedMediaRateLimitError) {
          setErr(localizedMediaRateLimitMessage());
        } else if (msg === "usage_query_failed" || msg === "usage_write_failed") {
          setErr(uiText.usageMigrationHint);
        } else {
          setErr(msg);
        }
      }
    });
  };

  useEffect(() => {
    setVisualUrls([]);
    setVisualIndex(0);
    setVisualStatus("idle");
    setVisualSubmitting(false);
    setLastVisualHQ(null);
    setVisualPbMatches(null);
  }, [storyId]);

  const applyUsagePayload = useCallback(
    (data: {
      dream_visual?: { remaining?: number; limit?: number };
      dream_visual_hq?: { remaining?: number; limit?: number };
      dream_story?: { remaining?: number; limit?: number };
      dream_localized_media?: { remaining?: number; limit?: number };
      image_credits?: { standard?: number; hq?: number };
    }) => {
      if (data.dream_visual) {
        if (typeof data.dream_visual.remaining === "number") setDreamVisualRemaining(data.dream_visual.remaining);
        if (typeof data.dream_visual.limit === "number") setDreamVisualLimit(data.dream_visual.limit);
      }
      if (data.dream_visual_hq) {
        if (typeof data.dream_visual_hq.remaining === "number") setDreamVisualHqRemaining(data.dream_visual_hq.remaining);
        if (typeof data.dream_visual_hq.limit === "number") setDreamVisualHqLimit(data.dream_visual_hq.limit);
      }
      if (data.dream_story) {
        if (typeof data.dream_story.remaining === "number") setDreamStoryRemaining(data.dream_story.remaining);
        if (typeof data.dream_story.limit === "number") setDreamStoryLimit(data.dream_story.limit);
      }
      if (data.dream_localized_media) {
        if (typeof data.dream_localized_media.remaining === "number") {
          setDreamLocalizedMediaRemaining(data.dream_localized_media.remaining);
        }
        if (typeof data.dream_localized_media.limit === "number") {
          setDreamLocalizedMediaLimit(data.dream_localized_media.limit);
        }
      }
      if (data.image_credits) {
        if (typeof data.image_credits.standard === "number") setImageCreditsStandard(data.image_credits.standard);
        if (typeof data.image_credits.hq === "number") setImageCreditsHq(data.image_credits.hq);
      }
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/ai-usage");
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          dream_visual?: { remaining?: number; limit?: number };
          dream_visual_hq?: { remaining?: number; limit?: number };
          dream_story?: { remaining?: number; limit?: number };
          dream_localized_media?: { remaining?: number; limit?: number };
          image_credits?: { standard?: number; hq?: number };
        };
        if (cancelled || !res.ok || !data.ok) return;
        applyUsagePayload(data);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, applyUsagePayload]);

  const refreshDreamTheaterUsageQuotas = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-usage");
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        dream_visual?: { remaining?: number; limit?: number };
        dream_visual_hq?: { remaining?: number; limit?: number };
        dream_story?: { remaining?: number; limit?: number };
        dream_localized_media?: { remaining?: number; limit?: number };
        image_credits?: { standard?: number; hq?: number };
      };
      if (!res.ok || !data.ok) return;
      applyUsagePayload(data);
    } catch {
      // ignore
    }
  }, [applyUsagePayload]);

  useEffect(() => {
    // 兜底：如果某次 transition 异常导致 finally 未触发，避免按钮永久灰掉
    if (visualStatus !== "processing" && visualSubmitting) setVisualSubmitting(false);
    if (visualStatus !== "processing" && lastVisualHQ === null && (visualStatus === "succeeded" || visualStatus === "failed")) {
      // 兼容旧数据：至少记住当前这轮的“高质量开关”状态
      setLastVisualHQ(visualHQ);
    }
  }, [visualStatus, visualSubmitting]);

  useEffect(() => {
    if (!visualUrls.length || visualStatus !== "succeeded") return;
    if (Date.now() < visualAutoPlayPauseUntil) return;
    const t = window.setInterval(() => {
      setVisualIndex((i) => (i + 1) % visualUrls.length);
    }, 4000);
    return () => window.clearInterval(t);
  }, [visualUrls, visualStatus, visualAutoPlayPauseUntil]);

  useEffect(() => {
    if (!storyId || visualStatus !== "processing") return;
    const t = window.setInterval(() => {
      void (async () => {
        try {
          const res = await refreshDreamVisualJob({ storyId, highQuality: visualHQ });
          if (res.imageUrls?.length) {
            setVisualUrls(res.imageUrls);
            setVisualIndex((i) => (res.imageUrls.length ? Math.min(i, res.imageUrls.length - 1) : 0));
          }
          setVisualStatus(res.status);
          setVisualPbMatches(res.pbMatches);
        } catch {
          // ignore
        }
      })();
    }, 2500);
    return () => window.clearInterval(t);
  }, [storyId, visualStatus, visualHQ]);

  useEffect(() => {
    setVisualImgRetryTick(0);
    setVisualImgReady(false);
    setVisualImgFailed(false);
  }, [visualIndex, currentVisualUrl]);

  /** ref 避免轮询更新 visualUrls 时闭包里的 length 过时，导致点了没反应 */
  const bumpVisualIndex = useCallback((delta: number) => {
    const urls = visualUrlsRef.current;
    const len = urls.length;
    if (len <= 1) return;
    setVisualAutoPlayPauseUntil(Date.now() + 10_000);
    setVisualIndex((i) => (i + delta + len) % len);
  }, []);

  const onGenerateVisual = () => {
    if (!storyId) return;
    if (visualSubmitting) return;
    setErr("");
    setVisualStatus("processing");
    setVisualSubmitting(true);
    setLastVisualHQ(visualHQ);
    startTransition(async () => {
      try {
        const res = await submitDreamVisualJob({ storyId, highQuality: visualHQ });
        setVisualUrls(res.imageUrls ?? []);
        setVisualIndex(0);
        setVisualStatus(res.status);
        setVisualPbMatches(res.pbMatches);
        void refreshDreamTheaterUsageQuotas();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown";
        if (msg === dreamVisualPlusRequiredError) {
          setErr(uiText.visualPlusOnly);
        } else if (msg === dreamVisualRateLimitError || msg === dreamVisualHqRateLimitError) {
          setErr(uiText.visualRateLimitBuyPack);
        } else if (msg === dreamVisualHqPlusRequiredError) {
          setErr(uiText.visualHqPlusOnly);
        } else if (msg === "credits_write_failed") {
          setErr(uiText.usageMigrationHint);
        } else if (msg === "usage_query_failed" || msg === "usage_write_failed") {
          setErr(uiText.usageMigrationHint);
        } else {
          setErr(msg);
        }
        setVisualStatus("failed");
      } finally {
        setVisualSubmitting(false);
      }
    });
  };

  return (
    <div className="mt-4 rounded-xl border bg-white/60">
      <div className="flex items-center justify-between gap-2 p-4">
        <div>
          <div className="text-sm font-medium">{uiText.title}</div>
          <div className="mt-1 text-xs text-muted-foreground">{uiText.subtitle}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border bg-white p-1">
            <button
              type="button"
              onClick={() => onSwitchLocale("zh")}
              className={cn(
                "rounded-full px-3 py-1 text-xs",
                moduleLocale === "zh" ? "bg-black text-white" : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={moduleLocale === "zh"}
              disabled={pending}
            >
              {uiText.localeZh}
            </button>
            <button
              type="button"
              onClick={() => onSwitchLocale("en")}
              className={cn(
                "rounded-full px-3 py-1 text-xs",
                moduleLocale === "en" ? "bg-black text-white" : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={moduleLocale === "en"}
              disabled={pending}
            >
              {uiText.localeEn}
            </button>
          </div>
          <Button type="button" variant="secondary" className="rounded-full" onClick={() => setOpen((v) => !v)}>
            {open ? (moduleLocale === "zh" ? "收起" : "Collapse") : moduleLocale === "zh" ? "展开" : "Expand"}
          </Button>
        </div>
      </div>

      {open ? (
        <div className="space-y-4 border-t p-4">
          <div className="rounded-lg border bg-white p-3 text-xs text-muted-foreground">
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <span>
                <span className="text-foreground">{moduleLocale === "zh" ? "目标" : "Goal"}：</span>
                {goal.name}
              </span>
              <span>
                <span className="text-foreground">{moduleLocale === "zh" ? "类型" : "Type"}：</span>
                {goal.type}
              </span>
              <span>
                <span className="text-foreground">{moduleLocale === "zh" ? "进度" : "Progress"}：</span>
                {goal.currentAmount}/{goal.targetAmount}
              </span>
              {goal.deadline ? (
                <span>
                  <span className="text-foreground">{moduleLocale === "zh" ? "截止" : "Deadline"}：</span>
                  {goal.deadline}
                </span>
              ) : null}
            </div>
          </div>

          {!storyId ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">{uiText.keywords}</div>
                <div className="flex flex-wrap gap-2">
                  {presets.map((k) => {
                    const active = selected.includes(k);
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => toggleKeyword(k)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition",
                          active ? "border-black bg-black text-white" : "bg-white text-foreground hover:bg-muted",
                        )}
                        disabled={pending}
                        aria-pressed={active}
                      >
                        {k}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`dt-custom-${goal.id}`}>{uiText.customKeywords}</Label>
                  <Input
                    id={`dt-custom-${goal.id}`}
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder={uiText.customPlaceholder}
                    disabled={pending}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`dt-free-${goal.id}`}>{uiText.freeText}</Label>
                  <textarea
                    id={`dt-free-${goal.id}`}
                    value={freeText}
                    onChange={(e) => setFreeText(e.target.value)}
                    placeholder={uiText.freeTextPlaceholder}
                    disabled={pending}
                    className="min-h-[96px] w-full rounded-md border bg-white px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div>{pending ? (moduleLocale === "zh" ? "生成中…" : "Generating…") : ""}</div>
                  {dreamStoryRemaining !== null ? (
                    <p className="text-foreground/90">{uiText.storyQuotaLine(dreamStoryRemaining, dreamStoryLimit)}</p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  className="rounded-full"
                  onClick={onGenerate}
                  disabled={pending || (dreamStoryRemaining !== null && dreamStoryRemaining <= 0)}
                >
                  {uiText.generate}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm font-medium">{uiText.story}</div>
              <div className="whitespace-pre-wrap rounded-lg border bg-white p-4 text-sm leading-6">
                {currentStory || (pending ? (moduleLocale === "zh" ? "生成/切换中…" : "Loading…") : "")}
              </div>
              {pending ? <div className="text-xs text-muted-foreground">{uiText.translating}</div> : null}

              <div className="rounded-lg border bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div>
                      {uiText.narration}: {currentAudio ? (moduleLocale === "zh" ? "已生成" : "ready") : moduleLocale === "zh" ? "未生成" : "missing"} ·{" "}
                      {uiText.subtitles}: {currentSubtitle ? (moduleLocale === "zh" ? "已生成" : "ready") : moduleLocale === "zh" ? "未生成" : "missing"}
                    </div>
                    {dreamLocalizedMediaRemaining !== null ? (
                      <p className="text-foreground/90">{uiText.mediaQuotaLine(dreamLocalizedMediaRemaining, dreamLocalizedMediaLimit)}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="rounded-full"
                    onClick={onGenerateMedia}
                    disabled={pending || (dreamLocalizedMediaRemaining !== null && dreamLocalizedMediaRemaining <= 0)}
                  >
                    {uiText.genMedia}
                  </Button>
                </div>
                {currentAudio ? (
                  <div className="mt-2">
                    <audio controls src={currentAudio} className="w-full" />
                  </div>
                ) : null}
                {currentSubtitle ? (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {uiText.subtitles}:{" "}
                    <a href={currentSubtitle} target="_blank" rel="noreferrer" className="underline">
                      {moduleLocale === "zh" ? "查看 SRT" : "View SRT"}
                    </a>
                  </div>
                ) : null}
              </div>

              <div className="rounded-lg border bg-white p-3">
                <div className="text-sm font-medium">{uiText.visualTitle}</div>
                <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                  <p>{uiText.visualHint}</p>
                  <p>{uiText.visualMultiShot}</p>
                  {isPlusMember && dreamVisualRemaining !== null ? (
                    <p className="text-foreground/90">{uiText.visualQuotaLine(dreamVisualRemaining, dreamVisualLimit)}</p>
                  ) : !isPlusMember ? (
                    <p className="text-foreground/90">{uiText.visualPlusOnly}</p>
                  ) : null}
                  {isPlusMember && dreamVisualHqRemaining !== null && dreamVisualHqLimit > 0 ? (
                    <p className="text-foreground/90">
                      {uiText.visualHqQuotaLine(dreamVisualHqRemaining, dreamVisualHqLimit)}
                    </p>
                  ) : null}
                  {isPlusMember && imageCreditsStandard > 0 ? (
                    <p className="text-foreground/90">{uiText.imageCreditsStandardLine(imageCreditsStandard)}</p>
                  ) : null}
                  {isPlusMember && imageCreditsHq > 0 ? (
                    <p className="text-foreground/90">{uiText.imageCreditsHqLine(imageCreditsHq)}</p>
                  ) : null}
                  {isPlusMember &&
                  dailyVisualRemaining !== null &&
                  dailyVisualRemaining <= 0 &&
                  packVisualRemaining < shotsNeeded ? (
                    <p className="text-foreground/90">
                      {uiText.visualRateLimitBuyPack}{" "}
                      <Link
                        href={`/${pageLocale}/pricing#credit-packs`}
                        className="font-medium text-foreground underline underline-offset-2"
                      >
                        {uiText.buyPackLink}
                      </Link>
                    </p>
                  ) : null}

                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    {moduleLocale === "zh" ? "状态" : "Status"}:{" "}
                    {visualStatus === "processing"
                      ? visualUrls.length > 0
                        ? uiText.visualProcessingPartial
                        : uiText.visualProcessing
                      : visualStatus === "succeeded"
                        ? uiText.visualReady
                        : visualStatus === "failed"
                          ? uiText.visualFailed
                          : moduleLocale === "zh"
                            ? "未开始"
                            : "idle"}
                    {visualStatus === "succeeded" && lastVisualHQ !== null ? (
                      <span className="ml-2">
                        {moduleLocale === "zh" ? "（当前：" : "("}
                        {lastVisualHQ ? (moduleLocale === "zh" ? "高质量" : "HQ") : moduleLocale === "zh" ? "普通" : "Standard"}
                        {moduleLocale === "zh" ? "）" : ")"}
                      </span>
                    ) : null}
                    {visualStatus === "succeeded" && lastVisualHQ !== null && visualHQ !== lastVisualHQ ? (
                      <span className="ml-2 text-amber-700">
                        {moduleLocale === "zh" ? "已切换质量，需点“生成图片画面”重新生成" : "Quality changed; click Generate to re-render"}
                      </span>
                    ) : null}
                    {visualStatus === "succeeded" && visualPbMatches === false ? (
                      <span className="ml-2 text-amber-700">{uiText.visualRuleUpdated}</span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label
                      className={cn(
                        "flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs",
                        isPlusMember ? "text-muted-foreground" : "text-muted-foreground/70",
                      )}
                      title={!isPlusMember ? uiText.visualHqPlusOnly : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={visualHQ}
                        onChange={(e) => setVisualHQ(e.target.checked)}
                        disabled={visualStatus === "processing" || !isPlusMember}
                      />
                      <span>{uiText.visualHQ}</span>
                    </label>
                    <Button
                      type="button"
                      className="rounded-full"
                      onClick={onGenerateVisual}
                      disabled={visualGenerateDisabled}
                    >
                      {visualStatus === "processing"
                        ? moduleLocale === "zh"
                          ? "生成中…"
                          : "Generating…"
                        : visualStatus === "succeeded"
                          ? moduleLocale === "zh"
                            ? "重新生成画面"
                            : "Regenerate"
                          : uiText.genVisual}
                    </Button>
                  </div>
                </div>

                {visualUrls[visualIndex] ? (
                  <div className="mt-3">
                    <div className="mb-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {moduleLocale === "zh" ? `镜头 ${visualIndex + 1}/${visualUrls.length}` : `Shot ${visualIndex + 1}/${visualUrls.length}`}
                      </span>
                    </div>
                    <div
                      className="outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
                      tabIndex={0}
                      role="group"
                      aria-label={moduleLocale === "zh" ? "梦想画面浏览" : "Dream visuals"}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowLeft") {
                          e.preventDefault();
                          bumpVisualIndex(-1);
                        } else if (e.key === "ArrowRight") {
                          e.preventDefault();
                          bumpVisualIndex(1);
                        }
                      }}
                    >
                      <div className="relative mx-auto min-h-[min(40vh,280px)] w-full max-w-xl">
                        {!visualImgReady && !visualImgFailed ? (
                          <div
                            className="pointer-events-none absolute inset-0 z-[15] flex items-center justify-center rounded-lg border bg-muted/40 text-xs text-muted-foreground"
                            aria-hidden
                          >
                            {uiText.visualImgLoading}
                          </div>
                        ) : null}
                        {visualImgFailed ? (
                          <div className="absolute inset-0 z-[15] flex min-h-[min(40vh,280px)] flex-col items-center justify-center gap-2 rounded-lg border border-destructive/20 bg-background/95 p-4 text-center text-xs">
                            <p className="text-muted-foreground">{uiText.visualImgError}</p>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="rounded-full"
                              onClick={() => {
                                setVisualImgFailed(false);
                                setVisualImgReady(false);
                                setVisualImgRetryTick((n) => n + 1);
                              }}
                            >
                              {uiText.visualImgRetry}
                            </Button>
                          </div>
                        ) : (
                          <img
                            key={`${visualIndex}-${visualDisplaySrc}`}
                            src={visualDisplaySrc}
                            alt={moduleLocale === "zh" ? `梦想画面 ${visualIndex + 1}/${visualUrls.length}` : `Dream visual ${visualIndex + 1}/${visualUrls.length}`}
                            loading="eager"
                            decoding="async"
                            draggable={false}
                            referrerPolicy="no-referrer"
                            onLoad={() => {
                              setVisualImgReady(true);
                              setVisualImgFailed(false);
                            }}
                            onError={() => {
                              setVisualImgReady(false);
                              setVisualImgFailed(true);
                            }}
                            className={cn(
                              "relative z-0 max-h-[min(70vh,36rem)] min-h-[min(40vh,280px)] w-full rounded-lg border bg-white object-contain select-none",
                              !visualImgReady && "opacity-0",
                            )}
                          />
                        )}
                        {visualUrls.length > 1 ? (
                          <>
                            <Button
                              type="button"
                              variant="secondary"
                              size="icon"
                              className="absolute left-1 top-1/2 z-20 h-11 w-11 -translate-y-1/2 touch-manipulation rounded-full border bg-background/90 shadow-md sm:left-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                bumpVisualIndex(-1);
                              }}
                              onPointerDown={(e) => e.stopPropagation()}
                              aria-label={moduleLocale === "zh" ? "上一张镜头" : "Previous shot"}
                            >
                              <ChevronLeft className="h-5 w-5" aria-hidden />
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="icon"
                              className="absolute right-1 top-1/2 z-20 h-11 w-11 -translate-y-1/2 touch-manipulation rounded-full border bg-background/90 shadow-md sm:right-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                bumpVisualIndex(1);
                              }}
                              onPointerDown={(e) => e.stopPropagation()}
                              aria-label={moduleLocale === "zh" ? "下一张镜头" : "Next shot"}
                            >
                              <ChevronRight className="h-5 w-5" aria-hidden />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {err ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              {err}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

