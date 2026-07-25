-- Link transactions to banquet parties (nullable; SET NULL if party deleted)

alter table public.transactions
  add column if not exists party_id uuid references public.banquet_parties(id) on delete set null;

create index if not exists transactions_user_party_id_idx
  on public.transactions (user_id, party_id)
  where party_id is not null;
