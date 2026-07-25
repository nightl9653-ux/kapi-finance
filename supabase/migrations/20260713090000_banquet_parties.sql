-- Banquet / party planning (materials, guests, timeline, palette as jsonb)

create table if not exists public.banquet_parties (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  party_date date not null,
  character_id text not null,
  party_type_id text,
  materials jsonb not null default '[]'::jsonb,
  color_palette jsonb not null default '{}'::jsonb,
  guests jsonb not null default '[]'::jsonb,
  timeline jsonb not null default '[]'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists banquet_parties_user_id_idx on public.banquet_parties (user_id);
create index if not exists banquet_parties_updated_at_idx on public.banquet_parties (user_id, updated_at desc);

alter table public.banquet_parties enable row level security;

drop policy if exists "banquet_parties_select_own" on public.banquet_parties;
create policy "banquet_parties_select_own"
on public.banquet_parties for select
using (user_id = auth.uid());

drop policy if exists "banquet_parties_insert_own" on public.banquet_parties;
create policy "banquet_parties_insert_own"
on public.banquet_parties for insert
with check (user_id = auth.uid());

drop policy if exists "banquet_parties_update_own" on public.banquet_parties;
create policy "banquet_parties_update_own"
on public.banquet_parties for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "banquet_parties_delete_own" on public.banquet_parties;
create policy "banquet_parties_delete_own"
on public.banquet_parties for delete
using (user_id = auth.uid());
