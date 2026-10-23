-- 私教约定节数。空表示没约定，页面不算「还剩几节」。

alter table public.studio_projects
  add column if not exists session_quota numeric;
