-- 梦想剧场：高质量文生图任务计次（与普通画面分开；仅 Plus）
alter table public.ai_usage add column if not exists dream_visual_hq_count int default 0;
