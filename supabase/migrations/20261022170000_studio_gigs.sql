-- 接单垂直：客户 + 项目（分期/成本存 jsonb）

create table if not exists public.studio_clients (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  company text,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists studio_clients_user_id_idx on public.studio_clients (user_id);
create index if not exists studio_clients_updated_at_idx
  on public.studio_clients (user_id, updated_at desc);

alter table public.studio_clients enable row level security;

drop policy if exists "studio_clients_select_own" on public.studio_clients;
create policy "studio_clients_select_own"
on public.studio_clients for select
using (user_id = auth.uid());

drop policy if exists "studio_clients_insert_own" on public.studio_clients;
create policy "studio_clients_insert_own"
on public.studio_clients for insert
with check (user_id = auth.uid());

drop policy if exists "studio_clients_update_own" on public.studio_clients;
create policy "studio_clients_update_own"
on public.studio_clients for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "studio_clients_delete_own" on public.studio_clients;
create policy "studio_clients_delete_own"
on public.studio_clients for delete
using (user_id = auth.uid());

create table if not exists public.studio_projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  client_id uuid references public.studio_clients(id) on delete cascade not null,
  name text not null,
  vertical text not null default 'other',
  currency text not null default 'USD',
  status text not null default 'active',
  notes text,
  installments jsonb not null default '[]'::jsonb,
  costs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists studio_projects_user_id_idx on public.studio_projects (user_id);
create index if not exists studio_projects_client_id_idx on public.studio_projects (client_id);
create index if not exists studio_projects_updated_at_idx
  on public.studio_projects (user_id, updated_at desc);

alter table public.studio_projects enable row level security;

drop policy if exists "studio_projects_select_own" on public.studio_projects;
create policy "studio_projects_select_own"
on public.studio_projects for select
using (user_id = auth.uid());

drop policy if exists "studio_projects_insert_own" on public.studio_projects;
create policy "studio_projects_insert_own"
on public.studio_projects for insert
with check (user_id = auth.uid());

drop policy if exists "studio_projects_update_own" on public.studio_projects;
create policy "studio_projects_update_own"
on public.studio_projects for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "studio_projects_delete_own" on public.studio_projects;
create policy "studio_projects_delete_own"
on public.studio_projects for delete
using (user_id = auth.uid());

alter table public.transactions
  add column if not exists studio_project_id uuid references public.studio_projects(id) on delete set null;

create index if not exists transactions_user_studio_project_id_idx
  on public.transactions (user_id, studio_project_id)
  where studio_project_id is not null;
