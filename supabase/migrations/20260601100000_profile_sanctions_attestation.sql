alter table public.profiles
  add column if not exists sanctions_attested_at timestamptz;

comment on column public.profiles.sanctions_attested_at is 'UTC when user attested they are not in a sanctioned/restricted jurisdiction at sign-up';
