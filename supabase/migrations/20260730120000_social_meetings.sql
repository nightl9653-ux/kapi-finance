-- 往来：朋友档案 + 见面记录（交往建议存 contacts.advice_items jsonb）

create table if not exists public.social_contacts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  alias text,
  relation text,
  phone text,
  email text,
  notes text,
  advice_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_contacts_user_id_idx on public.social_contacts (user_id);
create index if not exists social_contacts_updated_at_idx on public.social_contacts (user_id, updated_at desc);

create table if not exists public.social_meetings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  contact_id uuid references public.social_contacts(id) on delete cascade not null,
  met_on date not null,
  occasion text,
  score smallint not null default 0,
  feeling text,
  party_id uuid references public.banquet_parties(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_meetings_score_range check (score >= -10 and score <= 10)
);

create index if not exists social_meetings_user_id_idx on public.social_meetings (user_id);
create index if not exists social_meetings_contact_id_idx on public.social_meetings (contact_id);
create index if not exists social_meetings_met_on_idx on public.social_meetings (user_id, met_on desc);

alter table public.social_contacts enable row level security;
alter table public.social_meetings enable row level security;

drop policy if exists "social_contacts_select_own" on public.social_contacts;
create policy "social_contacts_select_own"
on public.social_contacts for select
using (user_id = auth.uid());

drop policy if exists "social_contacts_insert_own" on public.social_contacts;
create policy "social_contacts_insert_own"
on public.social_contacts for insert
with check (user_id = auth.uid());

drop policy if exists "social_contacts_update_own" on public.social_contacts;
create policy "social_contacts_update_own"
on public.social_contacts for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "social_contacts_delete_own" on public.social_contacts;
create policy "social_contacts_delete_own"
on public.social_contacts for delete
using (user_id = auth.uid());

drop policy if exists "social_meetings_select_own" on public.social_meetings;
create policy "social_meetings_select_own"
on public.social_meetings for select
using (user_id = auth.uid());

drop policy if exists "social_meetings_insert_own" on public.social_meetings;
create policy "social_meetings_insert_own"
on public.social_meetings for insert
with check (user_id = auth.uid());

drop policy if exists "social_meetings_update_own" on public.social_meetings;
create policy "social_meetings_update_own"
on public.social_meetings for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "social_meetings_delete_own" on public.social_meetings;
create policy "social_meetings_delete_own"
on public.social_meetings for delete
using (user_id = auth.uid());
