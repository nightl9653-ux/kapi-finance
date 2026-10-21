-- 旅行计划账：行程 + 费用清单（jsonb）；交易可挂 travel_trip_id

create table if not exists public.travel_trips (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  destination text,
  currency text not null default 'USD',
  budget_cap decimal(12, 2),
  start_date date,
  end_date date,
  notes text,
  items jsonb not null default '[]'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists travel_trips_user_id_idx on public.travel_trips (user_id);
create index if not exists travel_trips_updated_at_idx on public.travel_trips (user_id, updated_at desc);

alter table public.travel_trips enable row level security;

drop policy if exists "travel_trips_select_own" on public.travel_trips;
create policy "travel_trips_select_own"
on public.travel_trips for select
using (user_id = auth.uid());

drop policy if exists "travel_trips_insert_own" on public.travel_trips;
create policy "travel_trips_insert_own"
on public.travel_trips for insert
with check (user_id = auth.uid());

drop policy if exists "travel_trips_update_own" on public.travel_trips;
create policy "travel_trips_update_own"
on public.travel_trips for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "travel_trips_delete_own" on public.travel_trips;
create policy "travel_trips_delete_own"
on public.travel_trips for delete
using (user_id = auth.uid());

alter table public.transactions
  add column if not exists travel_trip_id uuid references public.travel_trips(id) on delete set null;

create index if not exists transactions_user_travel_trip_id_idx
  on public.transactions (user_id, travel_trip_id)
  where travel_trip_id is not null;
