-- 梦想剧场：旁白/字幕/翻译（generateLocalizedStoryMedia）每日计次
alter table public.ai_usage add column if not exists dream_localized_media_count int default 0;
