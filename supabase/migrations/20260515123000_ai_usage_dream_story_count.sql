-- 梦想剧场：按日统计「新生成小作文」次数（命中 input_hash 缓存的不写入）
alter table public.ai_usage add column if not exists dream_story_count int default 0;
