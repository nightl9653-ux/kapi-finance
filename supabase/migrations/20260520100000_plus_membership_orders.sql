-- Plus 会员购买记录（webhook 幂等；开通 profiles.is_plus_member）
create table if not exists public.plus_membership_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null,
  provider text not null,
  external_order_id text not null,
  created_at timestamptz not null default now(),
  unique (provider, external_order_id)
);

create index if not exists plus_membership_orders_user_created_idx
  on public.plus_membership_orders (user_id, created_at desc);

alter table public.plus_membership_orders enable row level security;

drop policy if exists "plus_membership_orders_select_own" on public.plus_membership_orders;
create policy "plus_membership_orders_select_own"
on public.plus_membership_orders for select
using (user_id = auth.uid());
