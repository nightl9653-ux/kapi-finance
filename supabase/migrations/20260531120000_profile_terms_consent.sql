-- Record explicit Terms + Privacy acceptance at sign-up (evidence chain).
alter table public.profiles
  add column if not exists terms_version text,
  add column if not exists terms_accepted_at timestamptz;

comment on column public.profiles.terms_version is 'LEGAL_POLICY_VERSION user agreed to at registration';
comment on column public.profiles.terms_accepted_at is 'UTC timestamp when terms_version was accepted';
