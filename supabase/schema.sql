-- Supabase schema for 咔皮·家庭财务规划平台
-- Note: In Supabase, `gen_random_uuid()` requires `pgcrypto`.
create extension if not exists "pgcrypto";

-- 用户资料表（扩展 Supabase Auth）
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  monthly_income decimal(10,2),
  risk_tolerance text default 'moderate',
  occupation text,
  fixed_expenses jsonb default '[]',
  is_plus_member boolean default false,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- 财务目标表
create table if not exists financial_goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  type text not null,
  target_amount decimal(12,2) not null,
  current_amount decimal(12,2) default 0,
  deadline date,
  priority integer default 2,
  monthly_minimum decimal(10,2),
  is_auto_allocate boolean default true,
  config jsonb default '{}',
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- 交易记录表
-- 产品规则（待入账 vs 已入账）：自动导入/扫账单时以「消费时间」（交易发生时间）界定 occurred_on 与 timestamp，不以银行最终入账时间为准。
-- 时区（跨境卡等）：库内「交易瞬间」列用 timestamptz，存绝对时间（写入侧用 ISO-8601 / UTC 语义）；展示时按用户所选/设备时区换算。
-- occurred_on 为「业务日」date：必须与「换算后的业务时区」一致，见下；禁止用未解释的 UTC 自然日或服务器会话时区随意切片。
-- 跨境 / 多源时间换算（导入层职责，与表结构配合）：
--   · 账单可能是 UTC、境外墙钟、或无时区字符串：导入时先根据渠道元数据或约定，解析为「唯一绝对瞬间」再写入 timestamp（例如 API 已给 RFC3339+offset/Z 则直接入库；若给「纽约 2024-01-15 14:30」则按 America/New_York 解析；禁止把无时区字符串当服务器本地猜）。
--   · occurred_on：在得到上述绝对瞬间后，再投影到「记账业务时区」（用户/账户配置的 IANA 时区，与浏览器设备时区可区分）取 **当地日历日** YYYY-MM-DD；该日才是业务日。同一瞬间在 UTC 与业务时区下的「日历日」可能不同，以业务时区为准。
--   · 仅有日期、无时刻：在 **明确该日期所属时区**（通常为账单展示时区或记账业务时区）下配中性 12:00 墙钟 → 转绝对瞬间写入 timestamp；occurred_on 与该墙钟在业务时区下的日期一致。
-- timestamp 取值规则（与 src/lib/transaction-timestamp-rules.ts 一致）：
--   · 数据源仅有日期、无时刻：仍存完整 timestamptz，取该业务日在「用户/账户 IANA 时区」下的中性时刻 12:00:00（墙钟）作为占位，且 occurred_on 与该业务日为同一天，避免「日期来自账单、时刻却是导入瞬间」。
--   · 数据源有完整消费时间：timestamp 用真实时刻；occurred_on 从该消费时间按业务日规则推导（以消费时间为准）；二者日期对齐。
create table if not exists transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  -- amount: 原币种金额（非本位币时需要配合 currency/fx_rate）
  amount decimal(10,2) not null,
  currency text default 'USD',
  fx_rate decimal(18,8),
  -- amount_base: 折算到本位币（USD）后的金额，用于统计/报表
  amount_base decimal(10,2),
  type text check (type in ('expense', 'income')),
  category text not null,
  sub_category text,
  merchant text,
  note text,
  -- occurred_on: 业务日历日（月视图/提醒/统计）；与 timestamptz 分离，便于按日查询与索引
  occurred_on date,
  -- 消费/记账瞬间（UTC 存储）；仅日期数据源见表头注释「中性 12:00」约定
  timestamp timestamptz default now(),
  images text[],
  goal_allocations jsonb default '{}',
  is_auto_recorded boolean default false,
  created_at timestamp default now()
);

create index if not exists transactions_user_occurred_on_idx
on transactions (user_id, occurred_on);

-- Backfill for existing rows (best-effort；会话时区非业务时区时可能与「记账业务日」不完全一致，仅作历史修补)
update transactions
set occurred_on = coalesce(occurred_on, (timestamp::date))
where occurred_on is null;

-- 存量库若 transactions."timestamp" 仍为 timestamp（无时区），可迁移为 timestamptz（先备份；旧数据若按 UTC 写入可用）：
-- alter table transactions alter column "timestamp" type timestamptz using ("timestamp" at time zone 'UTC');

-- 站内通知（不依赖推送权限）
create table if not exists notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  kind text not null,
  for_date date,
  title text not null,
  body text,
  read_at timestamp,
  created_at timestamp default now()
);

-- 每个用户/类型/日期最多 1 条，避免重复生成
create unique index if not exists notifications_unique_user_kind_date
on notifications (user_id, kind, for_date);

-- AI 使用记录表（用于限制免费用户每日次数）
create table if not exists ai_usage (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  date date default current_date,
  screenshot_count int default 0,
  voice_count int default 0,
  created_at timestamp default now()
);

-- 每人每天一行，便于 upsert 与扫单次数统计
create unique index if not exists ai_usage_user_date_uq on ai_usage (user_id, date);

-- 周期性账单（固定开销/收入）
create table if not exists recurring_bills (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  amount decimal(10,2) not null,
  currency text default 'USD',
  fx_rate decimal(18,8),
  type text check (type in ('expense', 'income')) not null,
  category text not null,
  merchant text,
  note text,
  cadence text check (cadence in ('daily', 'monthly', 'quarterly', 'yearly')) not null,
  month_of_year int,
  day_of_month int,
  start_date date default current_date,
  end_date date,
  last_generated_on date,
  created_at timestamp default now()
);

create index if not exists recurring_bills_user_idx on recurring_bills (user_id);
create index if not exists recurring_bills_user_active_idx on recurring_bills (user_id, end_date);

-- 订阅记录表
create table if not exists subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  status text,
  plan_type text,
  current_period_start timestamp,
  current_period_end timestamp,
  cancel_at_period_end boolean default false,
  created_at timestamp default now()
);

-- AI 洞察记录表
create table if not exists ai_insights (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  type text,
  title text not null,
  description text not null,
  action_items jsonb default '[]',
  is_dismissed boolean default false,
  created_at timestamp default now()
);

-- 成就记录表
create table if not exists user_achievements (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamp default now()
);

-- 启用 RLS（行级安全）
alter table profiles enable row level security;
alter table financial_goals enable row level security;
alter table transactions enable row level security;
alter table notifications enable row level security;
alter table ai_usage enable row level security;
alter table recurring_bills enable row level security;
alter table subscriptions enable row level security;
alter table ai_insights enable row level security;
alter table user_achievements enable row level security;

-- -----------------------------
-- RLS policies
-- -----------------------------

-- profiles: user can read/update own profile
create policy "profiles_select_own"
on profiles for select
using (id = auth.uid());

create policy "profiles_insert_own"
on profiles for insert
with check (id = auth.uid());

create policy "profiles_update_own"
on profiles for update
using (id = auth.uid())
with check (id = auth.uid());

-- financial_goals: CRUD limited to owner
create policy "goals_select_own"
on financial_goals for select
using (user_id = auth.uid());

create policy "goals_insert_own"
on financial_goals for insert
with check (user_id = auth.uid());

create policy "goals_update_own"
on financial_goals for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "goals_delete_own"
on financial_goals for delete
using (user_id = auth.uid());

-- transactions: CRUD limited to owner
create policy "transactions_select_own"
on transactions for select
using (user_id = auth.uid());

create policy "transactions_insert_own"
on transactions for insert
with check (user_id = auth.uid());

create policy "transactions_update_own"
on transactions for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "transactions_delete_own"
on transactions for delete
using (user_id = auth.uid());

-- notifications: CRUD limited to owner
create policy "notifications_select_own"
on notifications for select
using (user_id = auth.uid());

create policy "notifications_insert_own"
on notifications for insert
with check (user_id = auth.uid());

create policy "notifications_update_own"
on notifications for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "notifications_delete_own"
on notifications for delete
using (user_id = auth.uid());

-- ai_usage: CRUD limited to owner
create policy "ai_usage_select_own"
on ai_usage for select
using (user_id = auth.uid());

create policy "ai_usage_insert_own"
on ai_usage for insert
with check (user_id = auth.uid());

create policy "ai_usage_update_own"
on ai_usage for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "ai_usage_delete_own"
on ai_usage for delete
using (user_id = auth.uid());

-- recurring_bills: CRUD limited to owner
create policy "recurring_bills_select_own"
on recurring_bills for select
using (user_id = auth.uid());

create policy "recurring_bills_insert_own"
on recurring_bills for insert
with check (user_id = auth.uid());

create policy "recurring_bills_update_own"
on recurring_bills for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "recurring_bills_delete_own"
on recurring_bills for delete
using (user_id = auth.uid());

-- subscriptions: CRUD limited to owner (server should normally manage)
create policy "subscriptions_select_own"
on subscriptions for select
using (user_id = auth.uid());

create policy "subscriptions_insert_own"
on subscriptions for insert
with check (user_id = auth.uid());

create policy "subscriptions_update_own"
on subscriptions for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "subscriptions_delete_own"
on subscriptions for delete
using (user_id = auth.uid());

-- ai_insights: CRUD limited to owner
create policy "ai_insights_select_own"
on ai_insights for select
using (user_id = auth.uid());

create policy "ai_insights_insert_own"
on ai_insights for insert
with check (user_id = auth.uid());

create policy "ai_insights_update_own"
on ai_insights for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "ai_insights_delete_own"
on ai_insights for delete
using (user_id = auth.uid());

-- user_achievements: CRUD limited to owner
create policy "achievements_select_own"
on user_achievements for select
using (user_id = auth.uid());

create policy "achievements_insert_own"
on user_achievements for insert
with check (user_id = auth.uid());

create policy "achievements_update_own"
on user_achievements for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "achievements_delete_own"
on user_achievements for delete
using (user_id = auth.uid());

-- -----------------------------
-- Triggers / constraints
-- -----------------------------

-- Auto-create profile for new auth users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Free users can create at most 2 goals (Plus unlimited)
create or replace function public.enforce_goal_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_plus boolean;
  goal_count integer;
begin
  select coalesce(p.is_plus_member, false) into is_plus
  from public.profiles p
  where p.id = new.user_id;

  if is_plus then
    return new;
  end if;

  select count(*) into goal_count
  from public.financial_goals g
  where g.user_id = new.user_id;

  if goal_count >= 2 then
    raise exception 'Free plan goal limit reached' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists financial_goals_limit on public.financial_goals;
create trigger financial_goals_limit
before insert on public.financial_goals
for each row execute procedure public.enforce_goal_limit();

