-- 梦想剧场文生图：按日统计「新画面任务」次数（与扫单 screenshot_count、语音 voice_count 等共用 ai_usage 按日一行）
alter table public.ai_usage add column if not exists dream_visual_count int default 0;
