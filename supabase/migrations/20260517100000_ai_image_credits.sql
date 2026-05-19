-- AI 文生图加量包余额（Plus 购买；日限用尽后扣包内张数）
create table if not exists public.ai_image_credits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  standard_images_remaining int not null default 0,
  hq_images_remaining int not null default 0,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_credit_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_id text not null,
  provider text not null,
  external_order_id text not null,
  standard_granted int not null default 0,
  hq_granted int not null default 0,
  created_at timestamptz not null default now(),
  unique (provider, external_order_id)
);

create index if not exists ai_credit_purchases_user_created_idx
  on public.ai_credit_purchases (user_id, created_at desc);

alter table public.ai_image_credits enable row level security;
alter table public.ai_credit_purchases enable row level security;

drop policy if exists "ai_image_credits_select_own" on public.ai_image_credits;
create policy "ai_image_credits_select_own"
on public.ai_image_credits for select
using (user_id = auth.uid());

drop policy if exists "ai_credit_purchases_select_own" on public.ai_credit_purchases;
create policy "ai_credit_purchases_select_own"
on public.ai_credit_purchases for select
using (user_id = auth.uid());
