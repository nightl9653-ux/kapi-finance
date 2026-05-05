-- Idempotent incremental migration for existing Supabase projects.
-- Adds: budgets + budget_items, ai_usage.assistant_count, RLS, goals_net_stats RPC.
-- Safe to run multiple times.

-- -----------------------------------------------------------------------------
-- Budgets (monthly plan; AI may generate and persist)
-- -----------------------------------------------------------------------------
create table if not exists budgets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  month date not null,
  currency text default 'USD',
  source text default 'ai',
  note text,
  created_at timestamp default now()
);

create unique index if not exists budgets_user_month_uq
on budgets (user_id, month);

create index if not exists budgets_user_month_idx
on budgets (user_id, month desc);

create table if not exists budget_items (
  id uuid default gen_random_uuid() primary key,
  budget_id uuid references budgets(id) on delete cascade,
  category text not null,
  limit_base decimal(12,2) not null,
  pct decimal(6,2),
  rationale text,
  created_at timestamp default now()
);

create unique index if not exists budget_items_budget_category_uq
on budget_items (budget_id, category);

create index if not exists budget_items_budget_idx
on budget_items (budget_id);

-- -----------------------------------------------------------------------------
-- AI usage: assistant message rounds
-- -----------------------------------------------------------------------------
alter table public.ai_usage add column if not exists assistant_count int default 0;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table budgets enable row level security;
alter table budget_items enable row level security;

drop policy if exists "budgets_select_own" on budgets;
create policy "budgets_select_own"
on budgets for select
using (user_id = auth.uid());

drop policy if exists "budgets_insert_own" on budgets;
create policy "budgets_insert_own"
on budgets for insert
with check (user_id = auth.uid());

drop policy if exists "budgets_update_own" on budgets;
create policy "budgets_update_own"
on budgets for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "budgets_delete_own" on budgets;
create policy "budgets_delete_own"
on budgets for delete
using (user_id = auth.uid());

drop policy if exists "budget_items_select_own" on budget_items;
create policy "budget_items_select_own"
on budget_items for select
using (
  exists (
    select 1
    from budgets b
    where b.id = budget_items.budget_id
      and b.user_id = auth.uid()
  )
);

drop policy if exists "budget_items_insert_own" on budget_items;
create policy "budget_items_insert_own"
on budget_items for insert
with check (
  exists (
    select 1
    from budgets b
    where b.id = budget_items.budget_id
      and b.user_id = auth.uid()
  )
);

drop policy if exists "budget_items_update_own" on budget_items;
create policy "budget_items_update_own"
on budget_items for update
using (
  exists (
    select 1
    from budgets b
    where b.id = budget_items.budget_id
      and b.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from budgets b
    where b.id = budget_items.budget_id
      and b.user_id = auth.uid()
  )
);

drop policy if exists "budget_items_delete_own" on budget_items;
create policy "budget_items_delete_own"
on budget_items for delete
using (
  exists (
    select 1
    from budgets b
    where b.id = budget_items.budget_id
      and b.user_id = auth.uid()
  )
);

-- -----------------------------------------------------------------------------
-- Goals page: single-query net worth aggregates
-- -----------------------------------------------------------------------------
create index if not exists transactions_user_timestamp_idx
on public.transactions (user_id, "timestamp");

create or replace function public.goals_net_stats()
returns table (
  net_all numeric,
  net_month numeric,
  net_quarter numeric,
  net_year numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with bounds as (
    select
      (date_trunc('month', now() at time zone 'utc') at time zone 'utc') as month_ts,
      (date_trunc('quarter', now() at time zone 'utc') at time zone 'utc') as quarter_ts,
      (date_trunc('year', now() at time zone 'utc') at time zone 'utc') as year_ts
  ),
  signed as (
    select
      case
        when t.type = 'income' then coalesce(t.amount_base, 0)::numeric
        when t.type = 'expense' then -coalesce(t.amount_base, 0)::numeric
        else 0::numeric
      end as signed_amt,
      t."timestamp" as ts
    from public.transactions t
    where t.user_id = auth.uid()
      and t.amount_base is not null
      and t."timestamp" is not null
  )
  select
    coalesce((select sum(signed_amt) from signed), 0)::numeric,
    coalesce((select sum(signed_amt) from signed s cross join bounds b where s.ts >= b.month_ts), 0)::numeric,
    coalesce((select sum(signed_amt) from signed s cross join bounds b where s.ts >= b.quarter_ts), 0)::numeric,
    coalesce((select sum(signed_amt) from signed s cross join bounds b where s.ts >= b.year_ts), 0)::numeric;
$$;

grant execute on function public.goals_net_stats() to authenticated;
