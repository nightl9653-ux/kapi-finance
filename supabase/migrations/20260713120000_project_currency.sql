-- Project/party working currency (list amounts); ledger still converts to USD base

alter table public.banquet_parties
  add column if not exists currency text not null default 'USD';

alter table public.renovation_projects
  add column if not exists currency text not null default 'USD';
