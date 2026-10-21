-- 往来资金：交易可选挂到朋友档案（礼金 / 借贷写入总账）

alter table public.transactions
  add column if not exists social_contact_id uuid references public.social_contacts(id) on delete set null;

create index if not exists transactions_user_social_contact_id_idx
  on public.transactions (user_id, social_contact_id)
  where social_contact_id is not null;
