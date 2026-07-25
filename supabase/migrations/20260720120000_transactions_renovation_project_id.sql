-- Link ledger expenses back to a renovation / construction project

alter table public.transactions
  add column if not exists renovation_project_id uuid references public.renovation_projects(id) on delete set null;

create index if not exists transactions_user_renovation_project_id_idx
  on public.transactions (user_id, renovation_project_id)
  where renovation_project_id is not null;
