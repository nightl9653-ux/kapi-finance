-- Renovation / construction project planning (materials stored as jsonb)

create table if not exists public.renovation_projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  project_type text not null check (project_type in ('renovation', 'construction')),
  template_id text,
  area_sqm decimal(10, 2),
  budget_cap decimal(12, 2),
  address text,
  start_date date,
  target_end_date date,
  current_phase text,
  materials jsonb not null default '[]'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists renovation_projects_user_id_idx on public.renovation_projects (user_id);
create index if not exists renovation_projects_updated_at_idx on public.renovation_projects (user_id, updated_at desc);

alter table public.renovation_projects enable row level security;

drop policy if exists "renovation_projects_select_own" on public.renovation_projects;
create policy "renovation_projects_select_own"
on public.renovation_projects for select
using (user_id = auth.uid());

drop policy if exists "renovation_projects_insert_own" on public.renovation_projects;
create policy "renovation_projects_insert_own"
on public.renovation_projects for insert
with check (user_id = auth.uid());

drop policy if exists "renovation_projects_update_own" on public.renovation_projects;
create policy "renovation_projects_update_own"
on public.renovation_projects for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "renovation_projects_delete_own" on public.renovation_projects;
create policy "renovation_projects_delete_own"
on public.renovation_projects for delete
using (user_id = auth.uid());
