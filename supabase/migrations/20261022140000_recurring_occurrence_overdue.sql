-- 某一期（规则 + 到期日）用户确认逾期：跳过/取消该期自动入账

create table if not exists public.recurring_occurrence_overdue (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  recurring_bill_id uuid references public.recurring_bills(id) on delete cascade not null,
  due_on date not null,
  created_at timestamptz not null default now(),
  constraint recurring_occurrence_overdue_unique unique (recurring_bill_id, due_on)
);

create index if not exists recurring_occurrence_overdue_user_idx
  on public.recurring_occurrence_overdue (user_id);

create index if not exists recurring_occurrence_overdue_bill_idx
  on public.recurring_occurrence_overdue (recurring_bill_id, due_on);

alter table public.recurring_occurrence_overdue enable row level security;

drop policy if exists "recurring_occurrence_overdue_select_own" on public.recurring_occurrence_overdue;
create policy "recurring_occurrence_overdue_select_own"
on public.recurring_occurrence_overdue for select
using (user_id = auth.uid());

drop policy if exists "recurring_occurrence_overdue_insert_own" on public.recurring_occurrence_overdue;
create policy "recurring_occurrence_overdue_insert_own"
on public.recurring_occurrence_overdue for insert
with check (user_id = auth.uid());

drop policy if exists "recurring_occurrence_overdue_update_own" on public.recurring_occurrence_overdue;
create policy "recurring_occurrence_overdue_update_own"
on public.recurring_occurrence_overdue for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "recurring_occurrence_overdue_delete_own" on public.recurring_occurrence_overdue;
create policy "recurring_occurrence_overdue_delete_own"
on public.recurring_occurrence_overdue for delete
using (user_id = auth.uid());
