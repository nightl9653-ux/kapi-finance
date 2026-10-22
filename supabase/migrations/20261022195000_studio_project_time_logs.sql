-- 接单项目工时/课时（jsonb；单价可选）

alter table public.studio_projects
  add column if not exists time_logs jsonb not null default '[]'::jsonb;
